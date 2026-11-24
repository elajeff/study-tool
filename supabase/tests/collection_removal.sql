\set ON_ERROR_STOP on
begin;
-- Allow the fixture to create records in the format used before origin and context tracking.
grant execute on function public.accept_source_import(uuid,jsonb) to authenticated;
set local plpgsql.check_asserts=on;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000126','collection-a@example.test'),
('00000000-0000-4000-8000-000000000127','collection-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000126',true);
insert into public.sources(id,user_id,kind,name) values
  ('26000000-0000-4000-8000-000000000001',auth.uid(),'repository','Remove this'),
  ('26000000-0000-4000-8000-000000000002',auth.uid(),'repository','Keep this');
select public.accept_source_import('26000000-0000-4000-8000-000000000001',
  '[{"path":"test.md","content":"Synthetic import","artifact_id":null,"expected_path":null,"expected_revision_id":null}]');
do $$
declare source_id constant uuid := '26000000-0000-4000-8000-000000000001';
  snapshot_id constant text := 'X'||repeat('a',64);
  owner_id uuid := auth.uid();
  snapshot jsonb;
  outline jsonb;
  first_course uuid;
  confirmed_courses uuid[];
begin
  select jsonb_build_object('format','study-export/3','export_id',snapshot_id,'sources',jsonb_build_array(
    jsonb_build_object('id',id,'short_code',short_code,'kind',kind,'name',name)),'items','[]'::jsonb,'maps','[]'::jsonb)
  into snapshot from public.sources where id=source_id;
  perform public.save_library_export(snapshot);
  outline := jsonb_build_object('format','study-course/1','export_id',snapshot_id,'title','Test course',
    'goal','Learn','target','Build independently','assumed_level','Beginner','not_covered','[]'::jsonb,'open_questions','[]'::jsonb,
    'modules','[{"id":"M01","title":"Foundation","outcome":"Explain","proof":"Apply it","needs":[],"sources":["general"],"steps_estimate":1}]'::jsonb);
  first_course := public.save_course(outline);
  assert (select name='Test course' from public.library_courses_using_source(source_id) where id=first_course);

  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000127',true);
  assert not exists(select 1 from public.library_exports_using_source(source_id));
  assert not exists(select 1 from public.library_courses_using_source(source_id));
  begin
    perform public.remove_library_source(source_id, array[snapshot_id], array[first_course]);
    raise exception 'A foreign course and collection were removed';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  begin
    perform public.remove_library_source(source_id, array[]::text[], array[first_course]);
    raise exception 'Removal accepted an out-of-date snapshot list';
  exception when serialization_failure then null; end;
  assert (select count(*)=1 from public.library_exports_using_source(source_id));
  assert (select count(*)=1 from public.courses);
  perform public.save_course(jsonb_set(outline,'{title}','"New course"'));
  begin
    perform public.remove_library_source(source_id, array[snapshot_id], array[first_course]);
    raise exception 'Removal accepted an out-of-date course list';
  exception when serialization_failure then null; end;
  assert (select count(*)=2 from public.courses);
  confirmed_courses := array(select id from public.library_courses_using_source(source_id) order by id);
  perform public.remove_library_source(source_id, array[snapshot_id], confirmed_courses);
  assert (select count(*)=1 from public.sources);
  assert not exists(select 1 from public.source_revisions);
  assert not exists(select 1 from public.library_exports);
  assert not exists(select 1 from public.courses);
end $$;
rollback;
