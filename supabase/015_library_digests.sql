begin;
create table public.source_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_id uuid not null,
  artifact_id uuid not null,
  revision_id uuid not null,
  export_id text not null,
  context jsonb not null,
  path text not null,
  summary text not null check(char_length(trim(summary)) between 1 and 200 and position(chr(10) in summary)=0 and position(chr(13) in summary)=0),
  created_at timestamptz not null default clock_timestamp(),
  foreign key(user_id,source_id,artifact_id,revision_id) references public.source_revisions(user_id,source_id,artifact_id,id) on delete cascade,
  foreign key(user_id,export_id) references public.library_exports(user_id,id) on delete cascade
);
create index source_digests_revision_idx on public.source_digests(user_id,revision_id,created_at desc,id);
alter table public.source_digests enable row level security;
create policy "Owners read source digests" on public.source_digests for select to authenticated using(auth.uid()=user_id);
revoke all on public.source_digests from public,anon,authenticated;
grant select on public.source_digests to authenticated;

-- Corrections append a version. Repeated summaries do not erase newer corrections or old exports.
create function public.save_library_digest(p_export_id text,p_items jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare owner_id uuid := auth.uid(); manifest jsonb; entry jsonb; source_item jsonb;
  revision public.source_revisions%rowtype; item_context jsonb; summary_text text; saved integer := 0;
begin
  select e.manifest into manifest from public.library_exports e where e.id=p_export_id and e.user_id=owner_id;
  if not found then raise exception 'Export not found in this account.' using errcode='42501'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Expected digest items.' using errcode='22023'; end if;
  if jsonb_array_length(p_items) not between 1 and 500 or octet_length(p_items::text)>200000 then
    raise exception 'Import between 1 and 500 summaries within 200,000 bytes.' using errcode='22023';
  end if;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_items)) then
    raise exception 'Digest IDs must be distinct.' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('library-digest:'||owner_id::text,0));
  for entry in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(entry->'id') is distinct from 'string' or jsonb_typeof(entry->'summary') is distinct from 'string' then
      raise exception 'Invalid digest item.' using errcode='22023';
    end if;
    summary_text := trim(entry->>'summary');
    if char_length(summary_text) not between 1 and 200 or position(chr(10) in summary_text)>0 or position(chr(13) in summary_text)>0 then
      raise exception 'A summary must be one line of at most 200 characters.' using errcode='22023';
    end if;
    select value into source_item from jsonb_array_elements(manifest->'items') where value->>'id'=entry->>'id';
    if not found then raise exception 'Digest cites an item outside this export.' using errcode='22023'; end if;
    select * into revision from public.source_revisions r where r.id=(source_item->>'revision_id')::uuid and r.user_id=owner_id;
    if not found then raise exception 'Source revision not found in this account.' using errcode='42501'; end if;
    item_context := coalesce(source_item->'conversation'->'metadata','null'::jsonb);
    if not exists(select 1 from public.source_digests d where d.user_id=owner_id and d.revision_id=revision.id
      and d.context=item_context and d.path=source_item->>'path' and d.summary=summary_text) then
      insert into public.source_digests(user_id,source_id,artifact_id,revision_id,export_id,context,path,summary)
        values(owner_id,revision.source_id,revision.artifact_id,revision.id,p_export_id,item_context,source_item->>'path',summary_text);
      saved := saved+1;
    end if;
  end loop;
  return saved;
end;
$$;
revoke all on function public.save_library_digest(text,jsonb) from public,anon;
grant execute on function public.save_library_digest(text,jsonb) to authenticated;
commit;
