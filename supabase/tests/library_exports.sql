\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts=on;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000096','snapshot-a@example.test'),
('00000000-0000-4000-8000-000000000097','snapshot-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000096',true);
insert into public.sources(id,user_id,kind,name) values
('96000000-0000-4000-8000-000000000001',auth.uid(),'repository','Project'),
('96000000-0000-4000-8000-000000000002',auth.uid(),'chatgpt','Chats');
select public.accept_source_import('96000000-0000-4000-8000-000000000001','[{"path":"same.md","content":"Source π","artifact_id":null,"expected_path":null,"expected_revision_id":null}]');
select public.accept_source_import('96000000-0000-4000-8000-000000000002','[{"path":"same.md","external_id":"chat","content":"Source π","artifact_id":null,"expected_path":null,"expected_revision_id":null}]');
do $$
declare snapshot jsonb; invalid jsonb; snapshot_id text := 'X'||repeat('a',64); saved text; item jsonb;
begin
  select jsonb_build_object('format','study-export/3','export_id',snapshot_id,
    'sources',(select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'kind',s.kind,'short_code',s.short_code) order by s.kind desc) from public.sources s),
    'maps',jsonb_build_array(jsonb_build_object('id','R1/MAP/1','text','Map')),
    'items',(select jsonb_agg(jsonb_build_object('id',s.short_code||'/'||a.short_code,'source_id',s.id,'artifact_id',a.id,
      'revision_id',r.id,'path',a.path,'content_hash',r.content_hash)||case when s.kind='chatgpt' then
      jsonb_build_object('conversation',(select c.context from public.conversation_revision_context(array[r.id]) c)) else '{}'::jsonb end order by s.kind desc)
      from public.source_artifacts a join public.sources s on s.id=a.source_id join public.source_revisions r on r.id=a.current_revision_id)) into snapshot;
  saved := public.save_library_export(snapshot);
  assert saved=snapshot_id and public.save_library_export(snapshot)=snapshot_id;
  assert (select count(*)=1 from public.library_exports);
  for invalid in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_set(snapshot,'{card}','{}'),jsonb_set(snapshot,'{card}',to_jsonb(repeat('x',6001))))) loop
    begin
      perform public.save_library_export(invalid);
      raise exception 'Invalid card accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  for invalid in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_set(snapshot,'{sources,0,kind}','"claude"'),
    jsonb_set(snapshot,'{items,0,content_hash}','"wrong"'),
    jsonb_set(snapshot,'{items,0,source_id}','"96000000-0000-4000-8000-000000000002"'),
    jsonb_set(snapshot,'{items,1,conversation,import_id}','"96000000-0000-4000-8000-000000000099"'))) loop
    begin
      perform public.save_library_export(invalid);
      raise exception 'Invalid ownership or provenance accepted';
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    perform public.save_library_export(jsonb_set(snapshot,'{maps}','null'));
    raise exception 'Invalid maps accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_library_export(jsonb_set(snapshot,'{maps,0,text}','"Changed"'));
    raise exception 'Snapshot replaced';
  exception when unique_violation then null; end;
  item := snapshot->'items'->0;
  perform public.accept_source_import((item->>'source_id')::uuid,jsonb_build_array(jsonb_build_object(
    'artifact_id',item->>'artifact_id','expected_revision_id',item->>'revision_id','expected_path','same.md','path','renamed.md','content','New text')));
  assert (select e.manifest=snapshot from public.library_exports e where id=snapshot_id);
  assert exists(select 1 from public.source_revisions where id=(item->>'revision_id')::uuid and content='Source π');
  assert public.save_library_export(snapshot)=snapshot_id;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000097',true);
  assert not exists(select 1 from public.library_exports);
  begin
    perform public.save_library_export(snapshot);
    raise exception 'Foreign snapshot accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
