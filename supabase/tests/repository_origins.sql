\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts=on;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000098','origin@example.test'),
 ('00000000-0000-4000-8000-000000000099','other-origin@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000098',true);
insert into public.sources(id,user_id,kind,name) values('98000000-0000-4000-8000-000000000001',auth.uid(),'repository','Origin fixture');
do $$
declare origin jsonb; entry jsonb; run uuid; revision_uuid uuid; artifact_uuid uuid; m jsonb;
begin
 origin := jsonb_build_object('format','study-repository/1','kind','github','url','https://github.com/example/project','commit',repeat('a',40),'excluded','["generated.js"]'::jsonb);
 entry := jsonb_build_object('path','main.py','content','Original bytes','artifact_id',null,'expected_path',null,'expected_revision_id',null);
 run := public.accept_repository_import('98000000-0000-4000-8000-000000000001',jsonb_build_array(entry),origin);
 select id,current_revision_id into artifact_uuid,revision_uuid from public.source_artifacts;
 m := jsonb_build_object('format','study-export/3','export_id','X'||repeat('8',64),
  'maps','[]'::jsonb,'sources',jsonb_build_array(jsonb_build_object('id','98000000-0000-4000-8000-000000000001','kind','repository','name','Origin fixture','short_code','R1')),
  'items',jsonb_build_array(jsonb_build_object('id','R1/F001','source_id','98000000-0000-4000-8000-000000000001','artifact_id',artifact_uuid,
   'revision_id',revision_uuid,'path','main.py','content_hash',encode(sha256(convert_to('Original bytes','UTF8')),'hex'),'origin_import_id',run)),
  'origins',jsonb_build_array(jsonb_build_object('import_id',run,'source_id','98000000-0000-4000-8000-000000000001','origin',origin)));
 perform public.save_library_export(m);
 entry := entry||jsonb_build_object('artifact_id',artifact_uuid,'expected_path','main.py','expected_revision_id',revision_uuid);
 perform public.accept_repository_import('98000000-0000-4000-8000-000000000001',jsonb_build_array(entry),origin||jsonb_build_object('commit',repeat('b',40)));
 assert (select count(*)=1 from public.source_revisions);
 assert (select import_id=run from public.source_revisions);
 perform public.save_library_export(m);
 begin
  perform public.save_library_export(jsonb_set(m,'{origins,0,origin,commit}',to_jsonb(repeat('b',40))));
  assert false,'First-save origin must remain tied to its original import';
 exception when insufficient_privilege then null; end;
 begin
  update public.source_imports set repository_origin='{}';
  assert false,'Origins cannot be rewritten directly';
 exception when insufficient_privilege then null; end;
end $$;

do $$
declare
  origin jsonb := '{"format":"study-repository/1","kind":"github","url":"https://github.com/example/profile-repo","excluded":[]}'::jsonb
    || jsonb_build_object('commit',repeat('a',40));
  entries jsonb := '[{"path":"main.py","content":"Example","artifact_id":null,"expected_path":null,"expected_revision_id":null}]';
begin
  begin
    perform public.create_profile_repository('Profile repository','[]',origin);
    assert false,'Invalid batch must fail';
  exception when invalid_parameter_value then null; end;
  assert not exists(select 1 from public.sources where name='Profile repository'),'Failed import left a collection';

  perform public.create_profile_repository('Profile repository',entries,origin);
  assert (select count(*)=1 from public.source_imports where repository_origin=origin);
  begin
    perform public.create_profile_repository('Profile repository',entries,
      origin || '{"url":"https://github.com/Example/Profile-Repo"}'::jsonb);
    assert false,'Retry must reuse the saved repository';
  exception when serialization_failure then null; end;
  assert (select count(*)=1 from public.sources where name='Profile repository');

  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
  assert not exists(select 1 from public.source_imports where repository_origin=origin);
  perform public.create_profile_repository('Profile repository',entries,origin);
  assert (select count(*)=1 from public.source_imports where repository_origin=origin);
end $$;

rollback;
