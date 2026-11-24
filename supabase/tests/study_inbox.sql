\set ON_ERROR_STOP on
begin;
-- Allow the fixture to create records in the format used before origin and context tracking.
grant execute on function public.accept_source_import(uuid,jsonb) to authenticated;
set local plpgsql.check_asserts=on;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000096','inbox-a@example.test'),
('00000000-0000-4000-8000-000000000097','inbox-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000096',true);
insert into public.sources(id,user_id,kind,name) values('96000000-0000-4000-8000-000000000001',auth.uid(),'repository','Synthetic source');
select public.accept_source_import('96000000-0000-4000-8000-000000000001','[{"path":"one.md","content":"Source text","artifact_id":null,"expected_path":null,"expected_revision_id":null}]');
do $$
declare manifest jsonb; outline jsonb; plan jsonb; batch jsonb; result jsonb; course_uuid uuid; key text := 'X'||repeat('6',64);
  start_block jsonb; started_course uuid; started_step uuid;
begin
 select jsonb_build_object('format','study-export/3','export_id',key,
  'maps','[]'::jsonb,'sources',jsonb_build_array(jsonb_build_object('id',s.id,'name',s.name,'kind',s.kind,'short_code',s.short_code)),
  'items',jsonb_build_array(jsonb_build_object('id','R1/F001','source_id',s.id,'artifact_id',a.id,'revision_id',r.id,'path',a.path,'content_hash',r.content_hash)))
 into manifest from public.sources s join public.source_artifacts a on a.source_id=s.id join public.source_revisions r on r.id=a.current_revision_id;
 perform public.save_library_export(manifest);
 outline := jsonb_build_object('format','study-course/1','export_id',key,'title','Synthetic outline','goal','Learn','target','Independent','assumed_level','Beginner',
  'modules',jsonb_build_array(jsonb_build_object('id','M01','title','First','outcome','Explain','proof','Explain alone','needs','[]'::jsonb,'sources','["R1/F001"]'::jsonb,'steps_estimate',1)),
  'not_covered','[]'::jsonb,'open_questions','[]'::jsonb);
 batch := jsonb_build_array(jsonb_build_object('kind','course','course',outline),jsonb_build_object('kind','digest','export_id',key,'items','[{"id":"R1/F001","summary":"Source summary."}]'::jsonb));
 result := public.save_study_inbox(batch);course_uuid := (result->0->>'id')::uuid;
 assert result->0->>'created'='true' and result->1->>'new_items'='1';
 result := public.save_study_inbox(batch);
 assert result->0->>'created'='false' and result->1->>'new_items'='0';
 assert (select count(*)=1 from public.courses);
 plan := jsonb_build_object('format','study-module/1','course_id',course_uuid,'export_id',key,'module','M01',
  'steps',jsonb_build_array(jsonb_build_object('id','M01.S1','kind','explain','goal','Explain source','sources','["R1/F001"]'::jsonb,'done_when','Explain without help')));
 perform public.save_study_inbox(jsonb_build_array(jsonb_build_object('kind','module','course_id',course_uuid,'plan',plan)));
 begin
  perform public.save_study_inbox(jsonb_build_array(
   jsonb_build_object('kind','course','course',outline||jsonb_build_object('title','Must roll back')),
   jsonb_build_object('kind','digest','export_id',key,'items','[{"id":"R1/F001","summary":"Must roll back."}]'::jsonb),
   jsonb_build_object('kind','module','course_id',course_uuid,'plan',jsonb_set(plan,'{steps,0,goal}','"Different plan"'))));
  assert false,'A late failure must roll back the entire pasted response';
 exception when unique_violation then null; end;
 assert (select count(*)=1 from public.courses);
 assert (select count(*)=1 from public.source_digests);
 begin
  perform public.save_study_inbox('[{"kind":"evidence"}]');
  assert false,'Old assessment imports must be rejected';
 exception when invalid_parameter_value then null; end;
 assert not has_table_privilege(current_user,'public.assessment_receipts','INSERT,UPDATE');
 start_block := jsonb_build_object('kind','course','course',outline||jsonb_build_object('title','Start together'),'first_steps',plan->'steps');
 begin
  perform public.save_study_inbox(jsonb_build_array(jsonb_set(start_block,'{first_steps,0,sources}','["unknown"]')));
  assert false,'An invalid first plan must reject the complete import';
 exception when invalid_parameter_value then null; end;
 assert (select count(*)=1 from public.courses);
 result := public.save_study_inbox(jsonb_build_array(start_block));
 started_course := (result->0->>'id')::uuid;
 assert result->0->>'created'='true' and result->0->>'module'='M01';
 select s.id into strict started_step from public.course_steps s join public.course_modules m on m.id=s.module_id
  where m.course_id=started_course;
 update public.course_steps set completed_at=now() where id=started_step;
 result := public.save_study_inbox(jsonb_build_array(start_block));
 assert result->0->>'created'='false' and result->0->>'id'=started_course::text;
 assert (select completed_at is not null from public.course_steps where id=started_step);
 perform set_config('test.inbox_start',start_block::text,true);
 perform set_config('test.inbox_course',outline::text,true);
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000097',true);
do $$ begin
 assert not exists(select 1 from public.courses);
 begin
  perform public.save_study_inbox(jsonb_build_array(current_setting('test.inbox_start')::jsonb));
  assert false,'A course start cannot use another account''s export';
 exception when insufficient_privilege then null; end;
 begin
  perform public.save_study_inbox(jsonb_build_array(jsonb_build_object('kind','course','course',current_setting('test.inbox_course')::jsonb)));
  assert false,'Foreign exports cannot be imported';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
