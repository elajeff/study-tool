begin;
-- A transaction can accept multiple imports; transaction-start timestamps cannot order them.
alter table public.source_imports alter column accepted_at set default clock_timestamp();

-- Readers need import context, without the full message-offset arrays.
create function public.conversation_import_context(p_import_id uuid,p_metadata jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('import_id',p_import_id,'metadata',case when p_metadata is null then 'null'::jsonb
    else jsonb_build_object('created_at',p_metadata->'created_at','updated_at',p_metadata->'updated_at',
      'visible_messages',jsonb_array_length(p_metadata->'messages'),'excluded',p_metadata->'excluded','redactions',p_metadata->'redactions') end);
$$;
revoke all on function public.conversation_import_context(uuid,jsonb) from public,anon,authenticated;

-- Read the newest membership for each selected revision, never the revision's first import.
create function public.conversation_revision_context(p_revision_ids uuid[])
returns table(revision_id uuid,context jsonb)
language sql stable security definer set search_path='' as $$
  select distinct on (i.revision_id) i.revision_id,public.conversation_import_context(i.import_id,i.conversation_metadata)
  from public.source_import_items i
  join public.source_imports run on run.id=i.import_id
  join public.sources s on s.id=i.source_id
  where i.user_id=auth.uid() and i.revision_id=any(p_revision_ids) and s.kind in ('chatgpt','claude')
  order by i.revision_id,run.accepted_at desc,run.id desc;
$$;
revoke all on function public.conversation_revision_context(uuid[]) from public,anon;
grant execute on function public.conversation_revision_context(uuid[]) to authenticated;
commit;
