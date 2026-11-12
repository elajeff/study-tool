-- Apply after 003_source_identities.sql. Existing assessment keys are retained.
begin;
lock table public.notes in share row exclusive mode;

alter table public.notes
  add column source_id uuid,
  add column artifact_id uuid,
  add column imported_revision_id uuid;
alter table public.source_artifacts add column legacy_topic text
  check (char_length(legacy_topic) between 1 and 240);

-- Notes created after 003 also need a labelled snapshot, not an assumed original.
create temporary table legacy_note_sources on commit drop as
  select user_id, coalesce(
    (select id from public.sources s where s.user_id = n.user_id and s.kind = 'legacy_notes'
      order by created_at, id limit 1), gen_random_uuid()) as source_id, gen_random_uuid() as import_id
  from public.notes n where not exists (select 1 from public.source_artifacts a where a.id = n.id)
  group by user_id;
insert into public.sources(id, user_id, kind, name)
  select source_id, user_id, 'legacy_notes', 'Existing notes' from legacy_note_sources
  on conflict (id) do nothing;
insert into public.source_imports(id, user_id, source_id)
  select import_id, user_id, source_id from legacy_note_sources;
insert into public.source_artifacts(id, user_id, source_id, path)
  select n.id, n.user_id, s.source_id, n.path from public.notes n join legacy_note_sources s using (user_id)
  where not exists (select 1 from public.source_artifacts a where a.id = n.id);
insert into public.source_revisions(user_id, source_id, artifact_id, import_id, content, content_hash)
  select a.user_id, a.source_id, a.id, s.import_id, n.body, encode(sha256(convert_to(n.body, 'UTF8')), 'hex')
  from public.source_artifacts a join public.notes n on n.id = a.id
  join legacy_note_sources s on s.source_id = a.source_id where a.current_revision_id is null;
update public.source_artifacts a set current_revision_id = r.id
  from public.source_revisions r where r.artifact_id = a.id and a.current_revision_id is null;
insert into public.source_import_items(user_id, source_id, import_id, artifact_id, revision_id, path)
  select a.user_id, a.source_id, s.import_id, a.id, r.id, a.path
  from legacy_note_sources s join public.source_revisions r on r.import_id = s.import_id
  join public.source_artifacts a on a.id = r.artifact_id;

update public.notes n set source_id = a.source_id, artifact_id = a.id
  from public.source_artifacts a where a.id = n.id and a.user_id = n.user_id;
-- Keep the old assessment alias on the artifact, even if its editable note is deleted.
update public.source_artifacts a set legacy_topic = regexp_replace(a.path, '\.md$', '', 'i')
  from public.sources s where s.id = a.source_id and s.kind = 'legacy_notes' and a.path is not null;
update public.source_artifacts a set legacy_topic = regexp_replace(n.path, '\.md$', '', 'i')
  from public.notes n where n.artifact_id = a.id;
alter table public.notes
  add constraint note_source_pair check ((source_id is null) = (artifact_id is null)),
  add constraint note_artifact_fk foreign key (user_id, source_id, artifact_id)
    references public.source_artifacts(user_id, source_id, id),
  add constraint note_imported_revision_fk foreign key (user_id, source_id, artifact_id, imported_revision_id)
    references public.source_revisions(user_id, source_id, artifact_id, id),
  drop constraint notes_user_id_path_key;
create unique index notes_manual_path_idx on public.notes(user_id, path) where artifact_id is null;
create unique index notes_artifact_idx on public.notes(artifact_id) where artifact_id is not null;

-- Imported identity and assessment keys can only be assigned by the acceptance function.
revoke insert, update on public.notes from public, anon, authenticated;
grant insert (id, user_id, path, title, body, updated_at), update (body, updated_at) on public.notes to authenticated;

-- Vault imports must update editable notes through the preview-checked RPC below.
alter function public.accept_source_import(uuid, jsonb) rename to publish_source_import;
revoke all on function public.publish_source_import(uuid, jsonb) from public, anon, authenticated;
create function public.accept_source_import(p_source_id uuid, p_entries jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.sources where id = p_source_id and user_id = auth.uid()
    and kind in ('repository', 'chatgpt') for update;
  if not found then
    raise exception 'Raw imports require an owned repository or conversation source. Use the vault preview for Obsidian notes.' using errcode = '42501';
  end if;
  return public.publish_source_import(p_source_id, p_entries);
end;
$$;
revoke all on function public.accept_source_import(uuid, jsonb) from public, anon;
grant execute on function public.accept_source_import(uuid, jsonb) to authenticated;

create function public.vault_import_state(p_source_id uuid, p_paths text[])
returns table (artifact_id uuid, path text, revision_id uuid, baseline_hash text, note_id uuid, note_hash text, note_body text)
language sql stable security invoker set search_path = '' as $$
  select a.id, a.path, a.current_revision_id, r.content_hash, n.id,
    case when a.path = any(p_paths) then encode(sha256(convert_to(n.body, 'UTF8')), 'hex') end,
    case when a.path = any(p_paths) then n.body end
  from public.source_artifacts a
  left join public.notes n on n.artifact_id = a.id
  left join public.source_revisions r on r.id = n.imported_revision_id
  where a.source_id = p_source_id and a.user_id = auth.uid();
$$;
revoke all on function public.vault_import_state(uuid, text[]) from public, anon;
grant execute on function public.vault_import_state(uuid, text[]) to authenticated;

create function public.accept_obsidian_import(p_source_id uuid, p_entries jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  entry jsonb;
  target public.source_artifacts%rowtype;
  local_note public.notes%rowtype;
  target_id uuid;
  entry_path text;
  raw_entries jsonb := '[]';
  run_id uuid;
  item record;
begin
  perform 1 from public.sources where id = p_source_id and user_id = owner_id
    and kind in ('obsidian', 'legacy_notes') for update;
  if not found then
    raise exception 'Vault not found for this account.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'Import entries must be an array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_entries) not between 1 and 2000 or octet_length(p_entries::text) > 35 * 1024 * 1024 then
    raise exception 'Import at most 2000 files and 35 MiB of JSON at a time.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_entries) e group by lower(e ->> 'path') having count(*) > 1) then
    raise exception 'Duplicate paths in this import.' using errcode = '22023';
  end if;

  for entry in select value from jsonb_array_elements(p_entries) loop
    entry_path := entry ->> 'path';
    if jsonb_typeof(entry -> 'path') is distinct from 'string' or char_length(entry_path) not between 1 and 240
      or entry_path !~* '\.md$' or entry_path ~ '(^|/)\.' or entry_path ~ '^/|//|/$'
      or position(chr(92) in entry_path) > 0 or entry_path ~* '^(AI Chats|Progress|Tools)/'
      or jsonb_typeof(entry -> 'content') is distinct from 'string'
      or (entry ->> 'decision') is null or (entry ->> 'decision') not in ('keep', 'replace')
      or not (entry ?& array['artifact_id', 'expected_path', 'expected_revision_id', 'expected_note_hash']) then
      raise exception 'Invalid Markdown path, content, or preview decision.' using errcode = '22023';
    end if;
    target_id := (entry ->> 'artifact_id')::uuid;
    select * into target from public.source_artifacts
      where id = target_id and source_id = p_source_id and user_id = owner_id;
    if target_id is not null and not found then
      raise exception 'Artifact not found in this vault.' using errcode = '42501';
    end if;
    if exists (select 1 from public.source_artifacts a where a.source_id = p_source_id
      and lower(a.path) = lower(entry_path) and a.id is distinct from target_id) then
      raise exception 'This path is occupied. Refresh the preview or select its existing artifact.' using errcode = '23505';
    end if;
    select * into local_note from public.notes where artifact_id = target_id and user_id = owner_id for update;
    if target.path is distinct from (entry ->> 'expected_path')
      or target.current_revision_id is distinct from (entry ->> 'expected_revision_id')::uuid
      or (case when local_note.id is not null then encode(sha256(convert_to(local_note.body, 'UTF8')), 'hex') end)
        is distinct from (entry ->> 'expected_note_hash') then
      raise exception 'The vault or note changed after preview. Preview the files again.' using errcode = '40001';
    end if;
    raw_entries := raw_entries || jsonb_build_array(jsonb_build_object(
      'artifact_id', target_id, 'path', entry_path, 'content', entry ->> 'content'));
  end loop;

  run_id := public.publish_source_import(p_source_id, raw_entries);
  for item in select i.artifact_id, i.revision_id, i.path, e.value as entry
    from public.source_import_items i join jsonb_array_elements(p_entries) e on e.value ->> 'path' = i.path
    where i.import_id = run_id loop
    if item.entry ->> 'decision' = 'replace' then
      insert into public.notes(user_id, source_id, artifact_id, imported_revision_id, path, title, body)
        values (owner_id, p_source_id, item.artifact_id, item.revision_id,
          item.path, left(regexp_replace(regexp_replace(item.path, '^.*/', ''), '\.md$', '', 'i'), 160), item.entry ->> 'content')
        on conflict (artifact_id) where artifact_id is not null do update set
          path = excluded.path, title = excluded.title, body = excluded.body,
          imported_revision_id = excluded.imported_revision_id, updated_at = now();
    else
      update public.notes set path = item.path,
        title = left(regexp_replace(regexp_replace(item.path, '^.*/', ''), '\.md$', '', 'i'), 160),
        imported_revision_id = item.revision_id
        where artifact_id = item.artifact_id and user_id = owner_id;
    end if;
  end loop;
  return run_id;
end;
$$;
revoke all on function public.accept_obsidian_import(uuid, jsonb) from public, anon;
grant execute on function public.accept_obsidian_import(uuid, jsonb) to authenticated;
commit;
