begin;
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
