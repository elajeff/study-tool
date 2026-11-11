-- Apply after schema.sql and 002_assessments.sql. Existing application rows stay unchanged.
begin;

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('legacy_notes', 'obsidian', 'repository', 'chatgpt')),
  name text not null check (char_length(trim(name)) between 1 and 160),
  created_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.source_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_id uuid not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, source_id, id),
  foreign key (user_id, source_id) references public.sources(user_id, id) on delete cascade
);

create table public.source_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_id uuid not null,
  external_id text check (char_length(external_id) > 0),
  path text check (char_length(path) > 0),
  current_revision_id uuid,
  unique (user_id, source_id, id),
  unique (source_id, external_id),
  unique (source_id, path),
  check (external_id is not null or path is not null),
  foreign key (user_id, source_id) references public.sources(user_id, id) on delete cascade
);

create table public.source_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_id uuid not null,
  artifact_id uuid not null,
  import_id uuid not null,
  content text not null,
  content_hash text not null check (content_hash = encode(sha256(convert_to(content, 'UTF8')), 'hex')),
  unique (artifact_id, content_hash),
  unique (user_id, source_id, artifact_id, id),
  foreign key (user_id, source_id, artifact_id)
    references public.source_artifacts(user_id, source_id, id) on delete cascade,
  foreign key (user_id, source_id, import_id)
    references public.source_imports(user_id, source_id, id) on delete cascade
);

alter table public.source_artifacts add constraint artifact_current_revision_fk
  foreign key (user_id, source_id, id, current_revision_id)
  references public.source_revisions(user_id, source_id, artifact_id, id);

-- Records what each accepted batch saw, including unchanged content and renames.
create table public.source_import_items (
  user_id uuid not null,
  source_id uuid not null,
  import_id uuid not null,
  artifact_id uuid not null,
  revision_id uuid not null,
  path text,
  primary key (import_id, artifact_id),
  foreign key (user_id, source_id, import_id)
    references public.source_imports(user_id, source_id, id) on delete cascade,
  foreign key (user_id, source_id, artifact_id, revision_id)
    references public.source_revisions(user_id, source_id, artifact_id, id) on delete cascade
);

alter table public.sources enable row level security;
alter table public.source_imports enable row level security;
alter table public.source_artifacts enable row level security;
alter table public.source_revisions enable row level security;
alter table public.source_import_items enable row level security;

create policy "Owners read sources" on public.sources for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Owners create sources" on public.sources for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Owners rename sources" on public.sources for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners read imports" on public.source_imports for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Owners read artifacts" on public.source_artifacts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Owners read revisions" on public.source_revisions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Owners read import items" on public.source_import_items for select to authenticated
  using ((select auth.uid()) = user_id);

-- Only the atomic operation below can publish artifacts, revisions, and import records.
revoke all on public.sources, public.source_imports, public.source_artifacts,
  public.source_revisions, public.source_import_items from public, anon, authenticated;
grant select on public.sources, public.source_imports, public.source_artifacts,
  public.source_revisions, public.source_import_items to authenticated;
grant insert (id, user_id, kind, name), update (name) on public.sources to authenticated;

create function public.accept_source_import(p_source_id uuid, p_entries jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  run_id uuid := gen_random_uuid();
  entry jsonb;
  artifact public.source_artifacts%rowtype;
  requested_id uuid;
  external_key text;
  entry_path text;
  key_match uuid;
  path_match uuid;
  revision_id uuid;
  body text;
  hash text;
begin
  -- The source lock serializes batches for this source, not for the whole account.
  perform 1 from public.sources where id = p_source_id and user_id = owner_id for update;
  if not found then
    raise exception 'Source not found for this account.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'Import entries must be an array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_entries) not between 1 and 2000 then
    raise exception 'Import between 1 and 2000 artifacts at a time.' using errcode = '22023';
  end if;
  if octet_length(p_entries::text) > 35 * 1024 * 1024 then
    raise exception 'Import entries must fit within 35 MiB of JSON.' using errcode = '22023';
  end if;
  insert into public.source_imports(id, user_id, source_id) values (run_id, owner_id, p_source_id);

  for entry in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(entry -> 'content') is distinct from 'string' then
      raise exception 'Each artifact needs text content.' using errcode = '22023';
    end if;
    if jsonb_typeof(entry -> 'external_id') not in ('string', 'null')
      or jsonb_typeof(entry -> 'path') not in ('string', 'null') then
      raise exception 'External IDs and paths must be strings or null.' using errcode = '22023';
    end if;
    requested_id := (entry ->> 'artifact_id')::uuid;
    external_key := nullif(entry ->> 'external_id', '');
    entry_path := nullif(entry ->> 'path', '');
    body := entry ->> 'content';
    if char_length(body) > 500000 or octet_length(external_key) > 1024 or octet_length(entry_path) > 1024 then
      raise exception 'Content must be at most 500000 characters; IDs and paths at most 1024 bytes.' using errcode = '22023';
    end if;
    select id into key_match from public.source_artifacts
      where source_id = p_source_id and user_id = owner_id and external_id = external_key;
    select id into path_match from public.source_artifacts
      where source_id = p_source_id and user_id = owner_id and path = entry_path;

    if requested_id is not null then
      select * into artifact from public.source_artifacts
        where id = requested_id and source_id = p_source_id and user_id = owner_id;
      if not found then
        raise exception 'Artifact not found in this source.' using errcode = '42501';
      end if;
      if (key_match is not null and key_match <> artifact.id)
        or (artifact.external_id is not null and external_key is not null and artifact.external_id <> external_key) then
        raise exception 'Artifact ID and external ID disagree.' using errcode = '23505';
      end if;
    elsif key_match is not null then
      select * into artifact from public.source_artifacts where id = key_match;
    elsif path_match is not null then
      if external_key is not null then
        raise exception 'This path already exists. Supply its artifact ID to reconcile the external ID.' using errcode = '23505';
      end if;
      select * into artifact from public.source_artifacts where id = path_match;
    else
      insert into public.source_artifacts(user_id, source_id, external_id, path)
        values (owner_id, p_source_id, external_key, entry_path) returning * into artifact;
    end if;
    if path_match is not null and path_match <> artifact.id then
      raise exception 'The destination path belongs to another artifact.' using errcode = '23505';
    end if;

    hash := encode(sha256(convert_to(body, 'UTF8')), 'hex');
    insert into public.source_revisions(user_id, source_id, artifact_id, import_id, content, content_hash)
      values (owner_id, p_source_id, artifact.id, run_id, body, hash)
      on conflict (artifact_id, content_hash) do nothing returning id into revision_id;
    if revision_id is null then
      select id into revision_id from public.source_revisions where artifact_id = artifact.id and content_hash = hash;
    end if;
    update public.source_artifacts set current_revision_id = revision_id,
      path = coalesce(entry_path, artifact.path), external_id = coalesce(artifact.external_id, external_key)
      where id = artifact.id;
    insert into public.source_import_items(user_id, source_id, import_id, artifact_id, revision_id, path)
      values (owner_id, p_source_id, run_id, artifact.id, revision_id, coalesce(entry_path, artifact.path));
  end loop;
  return run_id;
end;
$$;
revoke all on function public.accept_source_import(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.accept_source_import(uuid, jsonb) to authenticated;

-- These are migration-time snapshots, not recovered originals or invented history.
-- Reusing note UUIDs gives the later adapter an explicit link without changing legacy paths.
lock table public.notes in share mode;
create temporary table legacy_sources on commit drop as
  select user_id, gen_random_uuid() as source_id, gen_random_uuid() as import_id
  from (select distinct user_id from public.notes) owners;
insert into public.sources(id, user_id, kind, name)
  select source_id, user_id, 'legacy_notes', 'Existing notes' from legacy_sources;
insert into public.source_imports(id, user_id, source_id)
  select import_id, user_id, source_id from legacy_sources;
insert into public.source_artifacts(id, user_id, source_id, path)
  select n.id, n.user_id, s.source_id, n.path from public.notes n join legacy_sources s using (user_id);
insert into public.source_revisions(user_id, source_id, artifact_id, import_id, content, content_hash)
  select n.user_id, s.source_id, n.id, s.import_id, n.body, encode(sha256(convert_to(n.body, 'UTF8')), 'hex')
  from public.notes n join legacy_sources s using (user_id);
update public.source_artifacts a set current_revision_id = r.id
  from public.source_revisions r where r.artifact_id = a.id;
insert into public.source_import_items(user_id, source_id, import_id, artifact_id, revision_id, path)
  select a.user_id, a.source_id, r.import_id, a.id, r.id, a.path
  from public.source_artifacts a join public.source_revisions r on r.id = a.current_revision_id;

commit;
