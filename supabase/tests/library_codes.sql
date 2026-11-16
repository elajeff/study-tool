-- Run after migration 007 in a disposable database. All fixtures are rolled back.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
insert into auth.users(id,email) values
  ('00000000-0000-4000-8000-000000000071','library-a@example.test'),
  ('00000000-0000-4000-8000-000000000072','library-b@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
insert into public.sources(id,user_id,kind,name) values
  ('70000000-0000-4000-8000-000000000001',auth.uid(),'chatgpt','Synthetic A'),
  ('70000000-0000-4000-8000-000000000002',auth.uid(),'chatgpt','Synthetic A2');
do $$
declare
  src uuid := '70000000-0000-4000-8000-000000000001';
  file_id uuid;
  first_revision uuid;
begin
  assert (select short_code='C1' from public.sources where id=src);
  perform public.accept_source_import(src,'[{"external_id":"first","path":"z.txt","content":"one"}]');
  select id,current_revision_id into file_id,first_revision from public.source_artifacts where source_id=src;
  perform public.accept_source_import(src,jsonb_build_array(
    jsonb_build_object('artifact_id',file_id,'external_id','first','path','renamed.txt','content','two'),
    jsonb_build_object('external_id','second','path','a.txt','content','three')));
  assert (select short_code='T001' and path='renamed.txt' from public.source_artifacts where id=file_id);
  assert (select content='one' from public.source_revisions where id=first_revision);
  assert (select short_code='T002' from public.source_artifacts where source_id=src and external_id='second');
  perform public.accept_source_import(src,'[{"external_id":"second","path":"a.txt","content":"four"}]');
  assert (select count(*)=2 from public.source_artifacts where source_id=src), 'Missing files remain saved';
  assert (select count(distinct r.import_id)=2 from public.source_artifacts a
    join public.source_revisions r on r.id=a.current_revision_id where a.source_id=src), 'A collection may span imports';
  begin
    update public.sources set short_code='C99' where id=src;
    assert false, 'Clients cannot rewrite short codes';
  exception when insufficient_privilege then null;
  end;
  perform public.accept_source_import('70000000-0000-4000-8000-000000000002',
    (select jsonb_agg(jsonb_build_object('external_id',n::text,'content','Synthetic item')) from generate_series(1,1001) n));
  assert (select count(distinct short_code)=1001 from public.source_artifacts
    where source_id='70000000-0000-4000-8000-000000000002');
  assert exists(select 1 from public.source_artifacts
    where source_id='70000000-0000-4000-8000-000000000002' and short_code='T1001');
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
insert into public.sources(id,user_id,kind,name) values
  ('70000000-0000-4000-8000-000000000003',auth.uid(),'chatgpt','Synthetic B');
do $$
begin
  assert (select count(*)=1 from public.sources);
  assert (select short_code='C1' from public.sources);
  assert not exists(select 1 from public.source_artifacts);
  assert not exists(select 1 from public.source_revisions);
  begin
    insert into public.sources(user_id,kind,name) values
      ('00000000-0000-4000-8000-000000000071','repository','Wrong owner');
    assert false, 'Sources must belong to the signed-in owner';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
