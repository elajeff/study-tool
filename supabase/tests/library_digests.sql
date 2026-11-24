\set ON_ERROR_STOP on
begin;
-- Allow the fixture to create records in the format used before origin and context tracking.
grant execute on function public.accept_source_import(uuid,jsonb) to authenticated;
set local plpgsql.check_asserts=on;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000106','digest-a@example.test'),
('00000000-0000-4000-8000-000000000107','digest-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000106',true);
insert into public.sources(id,user_id,kind,name) values
('94000000-0000-4000-8000-000000000001',auth.uid(),'repository','Synthetic repository'),
('94000000-0000-4000-8000-000000000002',auth.uid(),'chatgpt','Synthetic conversations');
select public.accept_source_import('94000000-0000-4000-8000-000000000001',
 '[{"path":"first.py","content":"Original source","artifact_id":null,"expected_path":null,"expected_revision_id":null}]');
do $$
declare entry jsonb; m jsonb; packed jsonb; future jsonb; chat uuid; chat_artifact uuid; cached jsonb;
begin
  entry := jsonb_build_object('external_id','chat','artifact_id',null,'expected_revision_id',null,'path','Title [chat]',
    'content',E'# "Title"\n\nUSER\nHello\n','metadata',jsonb_build_object('format','study-conversation/1','provider','chatgpt','offset_unit','utf8',
    'messages',jsonb_build_array(jsonb_build_object('id','u','role','user','start',10,'end',22)),
    'excluded',jsonb_build_object('other_branch_nodes',1),'redactions',0));
  perform public.accept_conversation_import('94000000-0000-4000-8000-000000000002',jsonb_build_array(entry));
  select id,current_revision_id into chat_artifact,chat from public.source_artifacts where external_id='chat';
  select jsonb_build_object('format','study-export/3','export_id','X'||repeat('1',64),
    'sources',(select jsonb_agg(jsonb_build_object('id',s.id,'short_code',s.short_code,'name',s.name,'kind',s.kind)) from public.sources s),
    'items',jsonb_agg(jsonb_build_object('id',s.short_code||'/'||a.short_code,'source_id',s.id,'artifact_id',a.id,'revision_id',r.id,'path',a.path,'content_hash',r.content_hash)
      ||case when s.kind='chatgpt' then jsonb_build_object('conversation',c.context) else '{}'::jsonb end), 'maps','[]'::jsonb)
  into m from public.sources s join public.source_artifacts a on a.source_id=s.id join public.source_revisions r on r.id=a.current_revision_id
    left join public.conversation_revision_context(array[chat]) c on c.revision_id=r.id;
  perform public.save_library_export(m);
  assert public.save_library_digest(m->>'export_id','[{"id":"R1/F001","summary":"First navigation summary."},{"id":"C1/T001","summary":"Visible conversation summary."}]')=2;
  assert public.save_library_digest(m->>'export_id','[{"id":"R1/F001","summary":"First navigation summary."}]')=0;
  begin
    perform public.save_library_digest(m->>'export_id','[{"id":"R1/F001","summary":"Must roll back."},{"id":"R1/F999","summary":"Unknown item."}]');
    assert false,'A failed batch cannot partially save summaries';
  exception when invalid_parameter_value then null; end;
  assert (select count(*)=2 from public.source_digests);
  select jsonb_agg(jsonb_build_object('id',i->>'id','digest_id',d.id,'summary',d.summary)) into cached
    from jsonb_array_elements(m->'items') i join public.source_digests d on d.revision_id=(i->>'revision_id')::uuid;
  packed := m||jsonb_build_object('export_id','X'||repeat('2',64),'digests',cached);
  perform public.save_library_export(packed);
  assert public.save_library_digest(m->>'export_id','[{"id":"R1/F001","summary":"Corrected navigation summary."}]')=1;
  -- Reimporting an old identical summary must not overwrite the newer correction.
  assert public.save_library_digest(m->>'export_id','[{"id":"R1/F001","summary":"First navigation summary."}]')=0;
  perform public.save_library_export(packed);
  assert (select manifest=packed from public.library_exports where id=packed->>'export_id');
  begin
    perform public.save_library_export(jsonb_set(packed,'{digests,0,summary}','"Spoofed summary"'));
    assert false,'Saved export summaries cannot be spoofed';
  exception when insufficient_privilege then null; end;
  begin
    update public.source_digests set summary='Rewritten';
    assert false,'Digest versions are immutable';
  exception when insufficient_privilege then null; end;
  entry := entry||jsonb_build_object('artifact_id',chat_artifact,'expected_revision_id',chat);
  perform public.accept_conversation_import('94000000-0000-4000-8000-000000000002',jsonb_build_array(entry));
  select packed||jsonb_build_object('export_id','X'||repeat('3',64),'items',jsonb_agg(case when i->>'id'='C1/T001'
    then i||jsonb_build_object('conversation',c.context) else i end)) into future
    from jsonb_array_elements(packed->'items') i cross join public.conversation_revision_context(array[chat]) c;
  perform public.save_library_export(future);
  -- Same transcript, changed branch/omission context: cached chat summary is stale.
  perform public.accept_conversation_import('94000000-0000-4000-8000-000000000002',
    jsonb_build_array(jsonb_set(entry,'{metadata,excluded,other_branch_nodes}','2')));
  select packed||jsonb_build_object('export_id','X'||repeat('4',64),'items',jsonb_agg(case when i->>'id'='C1/T001'
    then i||jsonb_build_object('conversation',c.context) else i end)) into future
    from jsonb_array_elements(packed->'items') i cross join public.conversation_revision_context(array[chat]) c;
  begin
    perform public.save_library_export(future);
    assert false,'A summary cannot cross a reconstruction context change';
  exception when insufficient_privilege then null; end;
  perform public.accept_source_import('94000000-0000-4000-8000-000000000001',
    (select jsonb_build_array(jsonb_build_object('path','moved/first.py','content',r.content,'artifact_id',a.id,
      'expected_path',a.path,'expected_revision_id',r.id))
     from public.source_artifacts a join public.source_revisions r on r.id=a.current_revision_id where a.source_id='94000000-0000-4000-8000-000000000001'));
  select packed||jsonb_build_object('export_id','X'||repeat('5',64),'items',jsonb_agg(case when i->>'id'='R1/F001'
    then i||jsonb_build_object('path','moved/first.py') else i end)) into future from jsonb_array_elements(packed->'items') i;
  begin
    perform public.save_library_export(future);
    assert false,'A summary cannot silently follow unchanged bytes to a new path';
  exception when insufficient_privilege then null; end;
  perform set_config('test.digest_export',m->>'export_id',true);
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000107',true);
do $$ begin
  assert not exists(select 1 from public.source_digests);
  begin
    perform public.save_library_digest(current_setting('test.digest_export'),'[{"id":"R1/F001","summary":"Foreign overwrite."}]');
    assert false,'Another account cannot write against this export';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
