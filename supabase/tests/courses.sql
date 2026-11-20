\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts=on;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000098','course-a@example.test'),
('00000000-0000-4000-8000-000000000099','course-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000098',true);
insert into public.sources(id,user_id,kind,name) values('98000000-0000-4000-8000-000000000001',auth.uid(),'repository','Empty project');
do $$
declare snapshot jsonb; outline jsonb; first_id uuid; changed_id uuid;
begin
  select jsonb_build_object('format','study-export/3','export_id','X'||repeat('b',64),'sources',jsonb_build_array(
    jsonb_build_object('id',id,'short_code',short_code,'kind',kind,'name',name)),'items','[]'::jsonb,'maps','[]'::jsonb)
  into snapshot from public.sources where id='98000000-0000-4000-8000-000000000001';
  perform public.save_library_export(snapshot);
  outline := jsonb_build_object('format','study-course/1','export_id',snapshot->>'export_id','title','General subject',
    'goal','Learn','target','Build independently','assumed_level','Beginner','not_covered','[]'::jsonb,'open_questions','[]'::jsonb,
    'modules',jsonb_build_array(jsonb_build_object('id','M01','title','Foundation','outcome','Explain','proof','Solve a changed problem',
      'needs','[]'::jsonb,'sources','["general"]'::jsonb,'steps_estimate',5)));
  first_id := public.save_course(outline);
  assert public.save_course(outline)=first_id;
  assert (select count(*)=1 from public.courses);
  changed_id := public.save_course(jsonb_set(outline,'{title}','"Different course"'));
  assert changed_id<>first_id and (select count(*)=2 from public.courses);
  begin
    insert into public.courses(user_id,export_id,raw_block) values(auth.uid(),snapshot->>'export_id',outline);
    raise exception 'Direct course writes bypassed the publisher';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_course(jsonb_set(outline,'{modules}','[]'));
    raise exception 'Empty course accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_course(outline #- '{modules,0,title}');
    raise exception 'Unreadable course accepted';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
  assert not exists(select 1 from public.courses);
  begin
    perform public.save_course(outline);
    raise exception 'Foreign export accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
