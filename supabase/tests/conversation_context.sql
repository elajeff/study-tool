\set ON_ERROR_STOP on
begin;
-- Allow the fixture to create records in the format used before origin and context tracking.
grant execute on function public.accept_source_import(uuid,jsonb) to authenticated;
set local plpgsql.check_asserts=on;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000092','context-a@example.test'),
('00000000-0000-4000-8000-000000000093','context-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
insert into public.sources(id,user_id,kind,name) values
('92000000-0000-4000-8000-000000000001',auth.uid(),'chatgpt','Synthetic context');
do $$
declare entry jsonb; rev uuid; original jsonb; latest jsonb;
begin
  entry := jsonb_build_object('external_id','chat','artifact_id',null,'expected_revision_id',null,'path','Title [chat]',
    'content',E'# "Title"\n\nUSER\nHello\n','metadata',jsonb_build_object('format','study-conversation/1','provider','chatgpt','offset_unit','utf8',
    'messages',jsonb_build_array(jsonb_build_object('id','u','role','user','start',10,'end',22,'created_at',1234)),
    'created_at',1234,'updated_at',1235,'excluded',jsonb_build_object('other_branch_nodes',1),'redactions',0));
  perform public.accept_conversation_import('92000000-0000-4000-8000-000000000001',jsonb_build_array(entry));
  select id into rev from public.source_revisions where source_id='92000000-0000-4000-8000-000000000001';
  select c.context into original from public.conversation_revision_context(array[rev]) c;
  assert original->'metadata'->>'visible_messages'='1';
  assert not (original->'metadata' ? 'messages');
  entry := entry||jsonb_build_object('artifact_id',(select artifact_id from public.source_revisions where id=rev),'expected_revision_id',rev);
  entry := jsonb_set(entry,'{metadata,excluded,other_branch_nodes}','7');
  perform public.accept_conversation_import('92000000-0000-4000-8000-000000000001',jsonb_build_array(entry));
  select c.context into latest from public.conversation_revision_context(array[rev]) c;
  assert latest->'metadata'->'excluded'->>'other_branch_nodes'='7';
  assert original->'metadata'->'excluded'->>'other_branch_nodes'='1';
  assert latest->>'import_id'<>original->>'import_id';
  assert (select count(*)=1 from public.source_revisions where source_id='92000000-0000-4000-8000-000000000001');
  perform public.accept_source_import('92000000-0000-4000-8000-000000000001',
    '[{"external_id":"legacy","content":"Legacy text without reconstruction metadata"}]');
  assert exists(select 1 from public.conversation_revision_context(array(
    select current_revision_id from public.source_artifacts where external_id='legacy')) c where c.context->'metadata'='null'::jsonb);
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000093',true);
  assert not exists(select 1 from public.conversation_revision_context(array[rev]));
end $$;
rollback;
