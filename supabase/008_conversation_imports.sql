begin;
alter table public.sources drop constraint sources_kind_check;
alter table public.sources add constraint sources_kind_check check(kind in ('legacy_notes','obsidian','repository','chatgpt','claude'));
alter table public.sources drop constraint source_short_code_format;
alter table public.sources add constraint source_short_code_format check(short_code ~ '^[RVCK][1-9][0-9]*$');
alter table public.source_import_items add column conversation_metadata jsonb;

create or replace function public.assign_source_short_code()
returns trigger language plpgsql security definer set search_path='' as $$
declare prefix text := case new.kind when 'repository' then 'R' when 'chatgpt' then 'C' when 'claude' then 'K' else 'V' end; n bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('library-source:'||new.user_id::text,0));
  select coalesce(max(substring(short_code from 2)::bigint),0)+1 into n from public.sources where user_id=new.user_id and left(short_code,1)=prefix;
  new.short_code := prefix||n;
  return new;
end;
$$;
create or replace function public.assign_artifact_short_code()
returns trigger language plpgsql security definer set search_path='' as $$
declare source_kind text; prefix text; n bigint;
begin
  select kind into source_kind from public.sources where id=new.source_id and user_id=new.user_id for update;
  if not found then raise exception 'Artifact owner must match an existing source.' using errcode='23503'; end if;
  prefix := case source_kind when 'repository' then 'F' when 'chatgpt' then 'T' when 'claude' then 'T' else 'N' end;
  select coalesce(max(substring(short_code from 2)::bigint),0)+1 into n from public.source_artifacts where source_id=new.source_id;
  new.short_code := prefix||lpad(n::text,greatest(3,length(n::text)),'0');
  return new;
end;
$$;

-- Keep metadata per accepted import, even when unchanged text reuses an older revision.
create or replace function public.accept_conversation_import(p_source_id uuid,p_entries jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid := auth.uid(); provider text; entry jsonb; meta jsonb; msg jsonb;
  target public.source_artifacts%rowtype; run_id uuid; body bytea; fragment text;
  previous_end integer; first_message boolean; start_at integer; end_at integer;
begin
  select kind into provider from public.sources where id=p_source_id and user_id=owner_id for update;
  if not found or provider not in ('chatgpt','claude') then raise exception 'Conversation source not found in this account.' using errcode='42501'; end if;
  if jsonb_typeof(p_entries) is distinct from 'array' then raise exception 'Expected conversation entries.' using errcode='22023'; end if;
  if jsonb_array_length(p_entries) not between 1 and 2000 or octet_length(p_entries::text)>35*1024*1024 then
    raise exception 'Import between 1 and 2000 conversations within 35 MiB.' using errcode='22023';
  end if;
  if (select count(*)<>count(distinct e->>'external_id') from jsonb_array_elements(p_entries) e) then
    raise exception 'Duplicate conversation identities.' using errcode='23505';
  end if;
  for entry in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(entry->'external_id') is distinct from 'string' or length(entry->>'external_id')=0
      or not(entry ?& array['artifact_id','expected_revision_id']) or jsonb_typeof(entry->'content') is distinct from 'string'
      or jsonb_typeof(entry->'path') is distinct from 'string' or length(entry->>'path')=0 then
      raise exception 'Invalid conversation entry.' using errcode='22023';
    end if;
    select * into target from public.source_artifacts where source_id=p_source_id and external_id=entry->>'external_id';
    if (entry->>'artifact_id')::uuid is distinct from target.id
      or (entry->>'expected_revision_id')::uuid is distinct from target.current_revision_id then
      raise exception 'Saved conversations changed after preview. Preview again.' using errcode='40001';
    end if;
    meta := entry->'metadata';
    if meta->>'format' is distinct from 'study-conversation/1' or meta->>'provider' is distinct from provider
      or meta->>'offset_unit' is distinct from 'utf8' or jsonb_typeof(meta->'messages') is distinct from 'array'
      or jsonb_typeof(meta->'excluded') is distinct from 'object' or jsonb_typeof(meta->'redactions') is distinct from 'number'
      or (meta - array['format','provider','offset_unit','messages','excluded','redactions','created_at','updated_at'])<>'{}'::jsonb then
      raise exception 'Invalid conversation metadata.' using errcode='22023';
    end if;
    if jsonb_array_length(meta->'messages')=0 then raise exception 'A conversation needs visible messages.' using errcode='22023'; end if;
    if (meta->>'redactions')!~'^[0-9]+$' or exists(select 1 from jsonb_each(meta->'excluded') pair
      where jsonb_typeof(pair.value)<>'number' or pair.value::text!~'^[0-9]+$' or length(pair.key)>80)
      or exists(select 1 from jsonb_each(meta) pair where pair.key in ('created_at','updated_at')
        and (jsonb_typeof(pair.value) not in ('null','number','string') or length(pair.value::text)>66)) then
      raise exception 'Invalid conversation dates or exclusion counts.' using errcode='22023';
    end if;
    if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(meta->'messages')) then
      raise exception 'Duplicate visible message identities.' using errcode='22023';
    end if;
    body := convert_to(entry->>'content','UTF8'); previous_end := 0; first_message := true;
    for msg in select value from jsonb_array_elements(meta->'messages') loop
      if jsonb_typeof(msg->'id') is distinct from 'string' or length(msg->>'id') not between 1 and 1024
        or coalesce(msg->>'role','') not in ('user','assistant') or jsonb_typeof(msg->'start') is distinct from 'number'
        or jsonb_typeof(msg->'end') is distinct from 'number' or (msg - array['id','role','start','end','created_at'])<>'{}'::jsonb
        or (msg ? 'created_at' and (jsonb_typeof(msg->'created_at') not in ('null','number','string') or length((msg->'created_at')::text)>66)) then
        raise exception 'Invalid visible message metadata.' using errcode='22023';
      end if;
      start_at := (msg->>'start')::integer; end_at := (msg->>'end')::integer;
      if start_at<previous_end or (not first_message and start_at<>previous_end) or end_at<=start_at or end_at>octet_length(body) then
        raise exception 'Invalid message offsets.' using errcode='22023';
      end if;
      fragment := convert_from(substring(body from start_at+1 for end_at-start_at),'UTF8');
      if left(fragment,length(msg->>'role')+2)<>chr(10)||upper(msg->>'role')||chr(10) then
        raise exception 'Message role does not match saved text.' using errcode='22023';
      end if;
      first_message := false; previous_end := end_at;
    end loop;
    if previous_end<>octet_length(body) then raise exception 'Incomplete message offsets.' using errcode='22023'; end if;
  end loop;
  run_id := public.publish_source_import(p_source_id,p_entries);
  update public.source_import_items i set conversation_metadata=e.value->'metadata'
    from jsonb_array_elements(p_entries) e join public.source_artifacts a on a.source_id=p_source_id and a.external_id=e.value->>'external_id'
    where i.import_id=run_id and i.artifact_id=a.id;
  return run_id;
end;
$$;
revoke all on function public.accept_conversation_import(uuid,jsonb) from public,anon;
grant execute on function public.accept_conversation_import(uuid,jsonb) to authenticated;
commit;
