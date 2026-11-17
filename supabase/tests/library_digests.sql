\set ON_ERROR_STOP on
begin;
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
declare entry jsonb; m jsonb; chat uuid;
begin
  entry := jsonb_build_object('external_id','chat','artifact_id',null,'expected_revision_id',null,'path','Title [chat]',
    'content',E'# "Title"\n\nUSER\nHello\n','metadata',jsonb_build_object('format','study-conversation/1','provider','chatgpt','offset_unit','utf8',
    'messages',jsonb_build_array(jsonb_build_object('id','u','role','user','start',10,'end',22)),
    'excluded',jsonb_build_object('other_branch_nodes',1),'redactions',0));
  perform public.accept_conversation_import('94000000-0000-4000-8000-000000000002',jsonb_build_array(entry));
  select current_revision_id into chat from public.source_artifacts where external_id='chat';
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
  assert public.save_library_digest(m->>'export_id','[{"id":"R1/F001","summary":"Corrected navigation summary."}]')=1;
  assert public.save_library_digest(m->>'export_id','[{"id":"R1/F001","summary":"First navigation summary."}]')=0;
  assert (select count(*)=3 from public.source_digests);
  assert (select content='Original source' from public.source_revisions where source_id='94000000-0000-4000-8000-000000000001');
  begin
    update public.source_digests set summary='Rewritten';
    raise exception 'Digest versions rewritten';
  exception when insufficient_privilege then null; end;
  perform set_config('test.digest_export',m->>'export_id',true);
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000107',true);
do $$ begin
  assert not exists(select 1 from public.source_digests);
  begin
    perform public.save_library_digest(current_setting('test.digest_export'),'[{"id":"R1/F001","summary":"Foreign overwrite."}]');
    raise exception 'Foreign digest accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
