begin;
-- Invoker privileges retain the existing owner RLS and FK checks for every write.
create or replace function public.save_study_inbox(p_blocks jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid := auth.uid(); entry jsonb; body jsonb; saved_id uuid;
  course_uuid uuid; first_module text; was_created boolean; added integer; results jsonb := '[]'::jsonb;
begin
  if owner_id is null then raise exception 'Sign in before importing.' using errcode='42501'; end if;
  if jsonb_typeof(p_blocks) is distinct from 'array' then raise exception 'Expected import blocks.' using errcode='22023'; end if;
  if jsonb_array_length(p_blocks) not between 1 and 20 or octet_length(p_blocks::text)>1024*1024 then
    raise exception 'Import at most 20 blocks within 1 MiB.' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('study-inbox:'||owner_id::text,0));
  for entry in select value from jsonb_array_elements(p_blocks) loop
    case entry->>'kind'
    when 'course' then
      body := entry->'course';
      select not exists(select 1 from public.courses where user_id=owner_id and export_id=body->>'export_id'
        and raw_block=body) into was_created;
      saved_id := public.save_course(body);
      first_module := null;
      if entry ? 'first_steps' then
        first_module := body#>>'{modules,0,id}';
        perform public.save_course_module(saved_id,jsonb_build_object(
          'format','study-module/1','course_id',saved_id,'export_id',body->>'export_id',
          'module',first_module,'steps',entry->'first_steps'));
      end if;
      results := results||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'kind','course','id',saved_id,'course_id',saved_id,'created',was_created,'module',first_module)));
    when 'module' then
      course_uuid := (entry->>'course_id')::uuid;
      saved_id := public.save_course_module(course_uuid,entry->'plan');
      results := results||jsonb_build_array(jsonb_build_object('kind','module','id',saved_id,'course_id',course_uuid));
    when 'digest' then
      added := public.save_library_digest(entry->>'export_id',entry->'items');
      results := results||jsonb_build_array(jsonb_build_object('kind','digest','export_id',entry->>'export_id','new_items',added));
    when 'evidence' then
      body := entry->'receipt';
      if coalesce(entry->>'fingerprint','')!~'^[a-f0-9]{64}$' then raise exception 'Invalid receipt fingerprint.' using errcode='22023'; end if;
      saved_id := null;
      insert into public.assessment_receipts(user_id,fingerprint,topic,date,level,task,evidence,independent,hints,artifact,next_step,step_id,status)
        values(owner_id,entry->>'fingerprint',body->>'topic',(body->>'date')::date,(body->>'level')::smallint,
          body->>'task',body->>'evidence',(body->>'independent')::boolean,body->>'hints',body->>'artifact',body->>'next_step',
          (body->>'step')::uuid,'pending') on conflict(user_id,fingerprint) do nothing returning id into saved_id;
      was_created := found;
      if not was_created then select id into saved_id from public.assessment_receipts where user_id=owner_id and fingerprint=entry->>'fingerprint'; end if;
      results := results||jsonb_build_array(jsonb_build_object('kind','evidence','id',saved_id,'created',was_created));
    else raise exception 'Unsupported import block.' using errcode='22023';
    end case;
  end loop;
  return results;
end;
$$;
commit;
