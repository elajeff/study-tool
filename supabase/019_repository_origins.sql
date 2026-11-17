begin;
alter table public.source_imports add column repository_origin jsonb;
create function public.accept_repository_import(p_source_id uuid,p_entries jsonb,p_origin jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare run_id uuid;
begin
  if not exists(select 1 from public.sources where id=p_source_id and user_id=auth.uid() and kind='repository') then
    raise exception 'Repository not found in this account.' using errcode='42501';
  end if;
  if p_origin->>'format' is distinct from 'study-repository/1' or coalesce(p_origin->>'kind','') not in ('github','archive')
    or jsonb_typeof(p_origin->'excluded') is distinct from 'array' or octet_length(p_origin::text)>1024*1024
    or (p_origin - array['format','kind','url','commit','excluded'])<>'{}'::jsonb then
    raise exception 'Invalid repository origin.' using errcode='22023';
  end if;
  if jsonb_array_length(p_origin->'excluded')>4000 or exists(select 1 from jsonb_array_elements(p_origin->'excluded') item
    where jsonb_typeof(item)<>'string' or octet_length(item::text)>2048) then
    raise exception 'Invalid excluded paths.' using errcode='22023';
  end if;
  if p_origin->>'kind'='github' then
    if jsonb_typeof(p_origin->'url') is distinct from 'string' or jsonb_typeof(p_origin->'commit') is distinct from 'string'
      or coalesce(p_origin->>'url','')!~'^https://github[.]com/[A-Za-z0-9-]+/[A-Za-z0-9_.-]+$'
      or coalesce(p_origin->>'commit','')!~'^[a-fA-F0-9]{40}$' then raise exception 'Invalid GitHub snapshot.' using errcode='22023'; end if;
  elsif p_origin->>'url' is not null or p_origin->>'commit' is not null then
    raise exception 'Local archives must leave the GitHub origin unknown.' using errcode='22023';
  end if;
  run_id := public.accept_source_import(p_source_id,p_entries);
  update public.source_imports set repository_origin=p_origin where id=run_id;
  return run_id;
end;
$$;
revoke all on function public.accept_repository_import(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.accept_repository_import(uuid,jsonb,jsonb) to authenticated;

create or replace function public.save_library_export(p_manifest jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  selected_sources jsonb;
  source_item jsonb;
  item jsonb;
  item_source uuid;
begin
  if octet_length(p_manifest::text)>2000000
    or p_manifest->>'format' is distinct from 'study-export/3'
    or jsonb_typeof(p_manifest->'items') is distinct from 'array'
    or jsonb_typeof(p_manifest->'maps') is distinct from 'array' then
    raise exception 'Invalid export manifest.' using errcode='22023';
  end if;
  selected_sources := p_manifest->'sources';
  if jsonb_typeof(selected_sources) is distinct from 'array' then
    raise exception 'Invalid export sources.' using errcode='22023';
  end if;
  if jsonb_array_length(selected_sources)=0
    or (select count(*)<>count(distinct value->>'id') or count(*)<>count(distinct value->>'short_code')
      from jsonb_array_elements(selected_sources)) then
    raise exception 'Select distinct export sources.' using errcode='22023';
  end if;
  for source_item in select value from jsonb_array_elements(selected_sources) loop
    if not exists(select 1 from public.sources s where s.id=(source_item->>'id')::uuid
      and s.user_id=owner_id and s.short_code=source_item->>'short_code'
      and s.name=source_item->>'name' and s.kind=source_item->>'kind') then
      raise exception 'Source does not match this account.' using errcode='42501';
    end if;
  end loop;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_manifest->'items')) then
    raise exception 'Duplicate export items.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_manifest->'maps') m
    where jsonb_typeof(m->'id') is distinct from 'string' or jsonb_typeof(m->'text') is distinct from 'string')
    or (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_manifest->'maps')) then
    raise exception 'Invalid export maps.' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_manifest->'items') loop
    item_source := (item->>'source_id')::uuid;
    if not exists(select 1 from public.source_revisions r join public.source_artifacts a on a.id=r.artifact_id
      join public.sources s on s.id=a.source_id
      where r.id=(item->>'revision_id')::uuid and r.artifact_id=(item->>'artifact_id')::uuid
        and r.user_id=owner_id and s.id=item_source
        and exists(select 1 from jsonb_array_elements(selected_sources) chosen where chosen->>'id'=s.id::text)
        and item->>'id'=s.short_code||'/'||a.short_code and item->>'content_hash'=r.content_hash
        and (item->>'path'=coalesce(a.path,a.external_id,'(no path)') or exists(
          select 1 from public.source_import_items i where i.artifact_id=a.id and i.revision_id=r.id and i.path=item->>'path'))) then
      raise exception 'Export item does not match a selected owned revision.' using errcode='42501';
    end if;
    if exists(select 1 from public.sources where id=item_source and kind in ('chatgpt','claude')) then
      if not exists(select 1 from public.source_import_items i
        where i.user_id=owner_id and i.source_id=item_source
          and i.artifact_id=(item->>'artifact_id')::uuid and i.revision_id=(item->>'revision_id')::uuid
          and i.import_id=(item->'conversation'->>'import_id')::uuid
          and i.path=item->>'path' and item->'conversation'=public.conversation_import_context(i.import_id,i.conversation_metadata)) then
        raise exception 'Conversation context does not match its owned import membership.' using errcode='42501';
      end if;
    elsif item ? 'conversation' then
      raise exception 'Conversation context requires a conversation source.' using errcode='22023';
    end if;
  end loop;
  if p_manifest ? 'card' and (jsonb_typeof(p_manifest->'card') is distinct from 'string' or char_length(p_manifest->>'card')>6000) then
    raise exception 'Invalid Library card.' using errcode='22023';
  end if;
  if p_manifest ? 'digests' then
    if jsonb_typeof(p_manifest->'digests') is distinct from 'array' then
      raise exception 'Invalid export digests.' using errcode='22023';
    end if;
    if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_manifest->'digests')) then
      raise exception 'Duplicate export digests.' using errcode='22023';
    end if;
    for item in select value from jsonb_array_elements(p_manifest->'digests') loop
      if not exists(select 1 from public.source_digests d
        join jsonb_array_elements(p_manifest->'items') chosen on (chosen->>'revision_id')::uuid=d.revision_id
        where d.user_id=owner_id and d.id=(item->>'digest_id')::uuid and item->>'summary'=d.summary
          and item->>'id'=chosen->>'id' and d.path=chosen->>'path' and d.context=coalesce(chosen->'conversation'->'metadata','null'::jsonb)) then
        raise exception 'Digest does not match an owned saved summary and source context.' using errcode='42501';
      end if;
    end loop;
  end if;
  if p_manifest ? 'origins' then
    if p_manifest->>'format'<>'study-export/3' or jsonb_typeof(p_manifest->'origins') is distinct from 'array' then
      raise exception 'Invalid repository origins.' using errcode='22023';
    end if;
    if (select count(*)<>count(distinct value->>'import_id') from jsonb_array_elements(p_manifest->'origins')) then
      raise exception 'Duplicate repository origins.' using errcode='22023';
    end if;
    for item in select value from jsonb_array_elements(p_manifest->'origins') loop
      if not exists(select 1 from public.source_imports i join public.sources s on s.id=i.source_id
        where i.user_id=owner_id and i.id=(item->>'import_id')::uuid and s.id=(item->>'source_id')::uuid and s.kind='repository'
          and i.repository_origin=item->'origin' and exists(select 1 from jsonb_array_elements(p_manifest->'items') chosen
            where chosen->>'origin_import_id'=i.id::text and chosen->>'source_id'=s.id::text)) then
        raise exception 'Repository origin does not match an owned import.' using errcode='42501';
      end if;
    end loop;
  end if;
  for item in select value from jsonb_array_elements(p_manifest->'items') where value ? 'origin_import_id' loop
    if not exists(select 1 from public.source_revisions r join public.sources s on s.id=r.source_id
      join jsonb_array_elements(p_manifest->'origins') origin on origin->>'import_id'=r.import_id::text
      where r.id=(item->>'revision_id')::uuid and r.user_id=owner_id and s.kind='repository'
        and r.import_id=(item->>'origin_import_id')::uuid and origin->>'source_id'=s.id::text) then
      raise exception 'Repository origin must match the revision first-save import.' using errcode='42501';
    end if;
  end loop;
  insert into public.library_exports(user_id,id,manifest) values(owner_id,p_manifest->>'export_id',p_manifest) on conflict do nothing;
  if not exists(select 1 from public.library_exports where user_id=owner_id and id=p_manifest->>'export_id' and manifest=p_manifest) then
    raise exception 'Export ID is already assigned to different material.' using errcode='23505';
  end if;
  return p_manifest->>'export_id';
end;
$$;
revoke all on function public.save_library_export(jsonb) from public,anon;
grant execute on function public.save_library_export(jsonb) to authenticated;
commit;
