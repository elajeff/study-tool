-- Run after migration 006 against a disposable development database.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
insert into auth.users(id,email) values
  ('00000000-0000-4000-8000-000000000051','repository-a@example.test'),
  ('00000000-0000-4000-8000-000000000052','repository-b@example.test');
insert into public.sources(id,user_id,kind,name) values
  ('a0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000051','repository','Repository A'),
  ('a0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000051','repository','Repository A2'),
  ('a0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000052','repository','Repository B');
create function pg_temp.repository_entry(src uuid,file_path text,body text,file_id uuid default null)
returns jsonb language sql as $$
  select jsonb_build_object('path',file_path,'content',body,'artifact_id',coalesce(a.id,file_id),
    'expected_path',a.path,'expected_revision_id',a.current_revision_id)
  from (select 1) singleton left join public.source_artifacts a on a.source_id=src
    and (case when file_id is null then a.path=file_path else a.id=file_id end);
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000051',true);
do $$
declare
  src uuid := 'a0000000-0000-4000-8000-000000000001';
  file_id uuid;
  first_revision uuid;
  entry jsonb;
  run_count bigint;
begin
  perform public.accept_source_import(src,jsonb_build_array(pg_temp.repository_entry(src,'src/Main.java','class Main {}')));
  select id,current_revision_id into file_id,first_revision from public.source_artifacts where source_id=src;
  perform set_config('test.repository_file',file_id::text,true);
  perform public.accept_source_import('a0000000-0000-4000-8000-000000000002',jsonb_build_array(
    pg_temp.repository_entry('a0000000-0000-4000-8000-000000000002','src/Main.java','class Main {}')));
  assert (select count(distinct id)=2 from public.source_artifacts where path='src/Main.java');
  perform public.accept_source_import(src,jsonb_build_array(pg_temp.repository_entry(src,'src/Main.java','class Main {}')));
  assert (select count(*)=1 from public.source_revisions where artifact_id=file_id);
  perform public.accept_source_import(src,jsonb_build_array(pg_temp.repository_entry(src,'src/Main.java','class Main { int n; }')));
  perform public.accept_source_import(src,jsonb_build_array(pg_temp.repository_entry(src,'src/Renamed.java','class Main { int n; }',file_id)));
  assert (select path='src/Renamed.java' from public.source_artifacts where id=file_id);
  assert (select count(*)=2 from public.source_revisions where artifact_id=file_id);
  assert (select content='class Main {}' from public.source_revisions where id=first_revision);
  assert not exists(select 1 from public.notes where user_id=auth.uid());
  assert not exists(select 1 from public.assessment_receipts where user_id=auth.uid());

  entry := pg_temp.repository_entry(src,'src/Renamed.java','Stale overwrite');
  perform public.accept_source_import(src,jsonb_build_array(pg_temp.repository_entry(src,'src/Renamed.java','class Main { int updated; }')));
  select count(*) into run_count from public.source_imports where source_id=src;
  begin
    perform public.accept_source_import(src,jsonb_build_array(pg_temp.repository_entry(src,'must-rollback.py','pass'),entry));
    assert false,'Stale previews must reject the entire import';
  exception when serialization_failure then null;
  end;
  assert not exists(select 1 from public.source_artifacts where source_id=src and path='must-rollback.py');
  for entry in select value from jsonb_array_elements(jsonb_build_array(
    '{"path":"bypass.java","content":"No preview"}'::jsonb,
    pg_temp.repository_entry(src,'../escape.py','pass'),
    pg_temp.repository_entry(src,'oversized.py',repeat('π',250001)))) loop
    begin
      perform public.accept_source_import(src,jsonb_build_array(entry));
      assert false,'Missing previews, unsafe paths, and oversized UTF-8 files must be denied';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  begin
    perform public.accept_source_import(src,jsonb_build_array(
      pg_temp.repository_entry(src,'one.java','same',file_id),pg_temp.repository_entry(src,'two.java','same',file_id)));
    assert false,'Two incoming files cannot claim one saved identity';
  exception when unique_violation then null;
  end;
  begin
    perform public.accept_source_import('a0000000-0000-4000-8000-000000000002',jsonb_build_array(
      pg_temp.repository_entry('a0000000-0000-4000-8000-000000000002','foreign.java','wrong repository',file_id)));
    assert false,'File identities cannot cross repositories';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*)=run_count from public.source_imports where source_id=src);
  assert (select r.content='class Main { int updated; }' from public.source_artifacts a
    join public.source_revisions r on r.id=a.current_revision_id where a.id=file_id);
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000052',true);
do $$
begin
  assert not exists(select 1 from public.source_artifacts);
  assert not exists(select 1 from public.source_revisions);
  begin
    perform public.accept_source_import('a0000000-0000-4000-8000-000000000001','[]');
    assert false,'Foreign repository imports must be denied';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.accept_source_import('a0000000-0000-4000-8000-000000000003',jsonb_build_array(
      pg_temp.repository_entry('a0000000-0000-4000-8000-000000000003','foreign.java','wrong owner',current_setting('test.repository_file')::uuid)));
    assert false,'Foreign file identities must be denied';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
\echo 'PASS: repository previews, revisions, rename identity, atomic failure, source-only data, and isolation'
