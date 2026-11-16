-- Repository previews use the existing publisher, without creating editable notes.
begin;
create or replace function public.accept_source_import(p_source_id uuid, p_entries jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  source_kind text;
  entry jsonb;
  entry_path text;
  target_id uuid;
  target public.source_artifacts%rowtype;
begin
  select kind into source_kind from public.sources where id=p_source_id and user_id=owner_id for update;
  if source_kind is null or source_kind not in ('repository','chatgpt') then
    raise exception 'Raw imports require an owned repository or conversation source. Use the vault preview for Obsidian notes.' using errcode='42501';
  end if;
  if source_kind='repository' then
    if jsonb_typeof(p_entries) is distinct from 'array' then
      raise exception 'Import entries must be an array.' using errcode='22023';
    end if;
    if jsonb_array_length(p_entries) not between 1 and 2000 or octet_length(p_entries::text)>35*1024*1024 then
      raise exception 'Import at most 2000 files and 35 MiB of JSON at a time.' using errcode='22023';
    end if;
    if exists(select 1 from jsonb_array_elements(p_entries) e group by lower(e->>'path') having count(*)>1)
      or exists(select 1 from jsonb_array_elements(p_entries) e where e->>'artifact_id' is not null group by e->>'artifact_id' having count(*)>1) then
      raise exception 'Two files cannot use the same path or saved file.' using errcode='23505';
    end if;
    for entry in select value from jsonb_array_elements(p_entries) loop
      entry_path := entry->>'path';
      if jsonb_typeof(entry->'path') is distinct from 'string' or octet_length(entry_path) not between 1 and 1024
        or entry_path ~ '^/|^[a-zA-Z]:|//|/$|(^|/)\.\.?(/|$)|[[:cntrl:]]' or position(chr(92) in entry_path)>0
        or jsonb_typeof(entry->'content') is distinct from 'string' or octet_length(entry->>'content')>500000
        or not(entry ?& array['artifact_id','expected_path','expected_revision_id'])
        or entry->>'external_id' is not null then
        raise exception 'Invalid repository path or missing preview references.' using errcode='22023';
      end if;
      target_id := (entry->>'artifact_id')::uuid;
      select * into target from public.source_artifacts where id=target_id and source_id=p_source_id and user_id=owner_id;
      if target_id is not null and not found then
        raise exception 'File not found in this repository.' using errcode='42501';
      end if;
      if exists(select 1 from public.source_artifacts a where a.source_id=p_source_id
        and lower(a.path)=lower(entry_path) and a.id is distinct from target_id) then
        raise exception 'This path belongs to another file. Review the preview.' using errcode='23505';
      end if;
      if target.path is distinct from entry->>'expected_path'
        or target.current_revision_id is distinct from (entry->>'expected_revision_id')::uuid then
        raise exception 'The repository changed after preview. Select the ZIP again.' using errcode='40001';
      end if;
    end loop;
  end if;
  return public.publish_source_import(p_source_id,p_entries);
end;
$$;
revoke all on function public.accept_source_import(uuid,jsonb) from public,anon;
grant execute on function public.accept_source_import(uuid,jsonb) to authenticated;
commit;
