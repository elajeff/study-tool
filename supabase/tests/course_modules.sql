\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts=on;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000100','module-a@example.test'),
('00000000-0000-4000-8000-000000000101','module-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000100',true);
insert into public.sources(id,user_id,kind,name) values('a1000000-0000-4000-8000-000000000001',auth.uid(),'repository','Synthetic ratios');
select public.accept_source_import('a1000000-0000-4000-8000-000000000001',
 '[{"path":"ratios.md","content":"Ratio example π","artifact_id":null,"expected_path":null,"expected_revision_id":null}]');
do $$
declare snapshot jsonb; outline jsonb; plan jsonb; changed jsonb; course_id uuid; other_course uuid; module_uuid uuid; first_step uuid;
begin
  select jsonb_build_object('format','study-export/3','export_id','X'||repeat('c',64),'sources',jsonb_build_array(
    jsonb_build_object('id',s.id,'name',s.name,'kind',s.kind,'short_code',s.short_code)),'maps','[]'::jsonb,
    'items',jsonb_build_array(jsonb_build_object('id',s.short_code||'/'||a.short_code,'source_id',s.id,'artifact_id',a.id,
      'revision_id',r.id,'path',a.path,'content_hash',r.content_hash))) into snapshot
  from public.sources s join public.source_artifacts a on a.source_id=s.id join public.source_revisions r on r.id=a.current_revision_id;
  perform public.save_library_export(snapshot);
  select jsonb_build_object('format','study-course/1','export_id',snapshot->>'export_id','title','Ratios','goal','Learn','target','Solve independently',
    'assumed_level','Beginner','not_covered','[]'::jsonb,'open_questions','[]'::jsonb,'modules',jsonb_agg(jsonb_build_object('id','M0'||n,
      'title','Foundation','outcome','Explain','proof','Solve a changed ratio','needs','[]'::jsonb,'sources','["general"]'::jsonb,'steps_estimate',5) order by n))
  into outline from generate_series(1,2) n;
  course_id := public.save_course(outline);
  other_course := public.save_course(jsonb_set(outline,'{title}','"Separate course"'));
  select jsonb_build_object('format','study-module/1','course_id',course_id,'export_id',snapshot->>'export_id','module','M01',
    'steps',jsonb_agg(jsonb_build_object('id','M01.S'||n,'kind','exercise','goal','Solve fresh case '||n,
      'sources',jsonb_build_array(snapshot->'items'->0->>'id','general'),'done_when','Explain the ratio and units.') order by n))
  into plan from generate_series(1,5) n;
  module_uuid := public.save_course_module(course_id,plan);
  select id into first_step from public.course_steps where module_id=module_uuid and position=1;
  assert public.save_course_module(course_id,plan)=module_uuid;
  assert exists(select 1 from public.course_steps where id=first_step);
  assert (select count(*)=5 from public.course_steps);
  assert (select completed_at is null from public.course_steps where id=first_step);
  insert into public.assessment_receipts(user_id,fingerprint,topic,step_id,date,level,task,evidence,independent,hints)
    values(auth.uid(),'lesson-review','course-step:'||first_step,first_step,'2026-11-17',2,'Explain a changed ratio','Explained units with guided hints.',false,'major');
  assert (select status='pending' from public.assessment_receipts where fingerprint='lesson-review');
  update public.assessment_receipts set status='approved',reviewed_at=now() where fingerprint='lesson-review';
  insert into public.assessment_receipts(user_id,fingerprint,topic,step_id,date,level,task,evidence,independent,hints,status)
    values(auth.uid(),'lesson-review','course-step:'||first_step,first_step,'2026-11-17',2,'Explain a changed ratio','Explained units with guided hints.',false,'major','pending')
    on conflict(user_id,fingerprint) do nothing;
  assert (select status='approved' from public.assessment_receipts where fingerprint='lesson-review');
  begin
    insert into public.assessment_receipts(user_id,fingerprint,topic,step_id,date,level,task,evidence,independent,hints)
      values(auth.uid(),'mismatched-topic','M01.S1',first_step,'2026-11-17',2,'Explain','Explained a changed example.',false,'major');
    raise exception 'Mismatched receipt topic accepted';
  exception when check_violation then null; end;
  update public.course_steps set completed_at='2026-11-17T12:00:00Z' where id=first_step;
  perform public.save_course_module(course_id,plan);
  assert (select completed_at='2026-11-17T12:00:00Z' from public.course_steps where id=first_step);
  assert (select step_id=first_step from public.assessment_receipts where fingerprint='lesson-review');
  update public.course_steps set completed_at=null where id=first_step;
  assert (select completed_at is null from public.course_steps where id=first_step);
  begin
    update public.course_steps set goal='Replace goal' where id=first_step;
    raise exception 'Lesson text updated directly';
  exception when insufficient_privilege then null; end;
  for changed in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_set(plan,'{course_id}',to_jsonb(other_course)),jsonb_set(plan,'{steps,0,id}','"M01.S2"'),
    jsonb_set(plan,'{steps,0,sources}','["R1/F999"]'))) loop
    begin
      perform public.save_course_module(course_id,changed);
      raise exception 'Invalid plan accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.save_course_module(course_id,jsonb_set(plan,'{steps,0,goal}','"Replace saved goal"'));
    raise exception 'Saved plan replaced';
  exception when unique_violation then null; end;
  select jsonb_set(jsonb_set(plan,'{module}','"M02"'),'{steps}',jsonb_agg(jsonb_build_object('id','M02.S'||n,'kind','explain',
    'goal',repeat('α',3000),'sources','["general"]'::jsonb,'done_when',repeat('β',3000)) order by n)) into changed from generate_series(1,12) n;
  perform public.save_course_module(course_id,changed);
  assert (select count(*)=17 from public.course_steps);
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
  assert not exists(select 1 from public.course_modules) and not exists(select 1 from public.course_steps);
  update public.course_steps set completed_at=now() where id=first_step;
  assert not found, 'Foreign progress was updated';
  begin
    insert into public.assessment_receipts(user_id,fingerprint,topic,step_id,date,level,task,evidence,independent,hints)
      values(auth.uid(),'foreign-step','course-step:'||first_step,first_step,'2026-11-17',2,'Explain','Explained a changed example.',false,'major');
    raise exception 'Foreign lesson receipt accepted';
  exception when foreign_key_violation then null; end;
  begin
    perform public.save_course_module(course_id,plan);
    raise exception 'Foreign course accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000100',true);
  assert (select completed_at is null from public.course_steps where id=first_step);
end $$;
reset role;
delete from public.course_modules where user_id='00000000-0000-4000-8000-000000000100';
do $$ begin
  assert (select step_id is null and topic like 'course-step:%' from public.assessment_receipts where fingerprint='lesson-review');
end $$;
rollback;
