-- Allow ordinary vault folders while keeping ChatBridge archives out of note imports.
begin;

create or replace function public.accept_obsidian_import(p_source_id uuid, p_entries jsonb)
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
      or position(chr(92) in entry_path) > 0 or entry_path ~* '(^|/)AI Chats/'
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

commit;
