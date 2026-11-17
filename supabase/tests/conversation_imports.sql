\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts=on;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000089','conversation-a@example.test'),
('00000000-0000-4000-8000-000000000090','conversation-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000089',true);
insert into public.sources(id,user_id,kind,name) values
('89000000-0000-4000-8000-000000000001',auth.uid(),'chatgpt','Synthetic ChatGPT'),
('89000000-0000-4000-8000-000000000002',auth.uid(),'claude','Synthetic Claude');
do $$
declare entry jsonb; batch jsonb; changed_entry jsonb; first_run uuid; second_run uuid; artifact_uuid uuid; revision_uuid uuid;
  original_text text := E'# "😀"\n\nUSER\nπ 😀\n'; size integer;
begin
  assert (select short_code='C1' from public.sources where kind='chatgpt');
  assert (select short_code='K1' from public.sources where kind='claude');
  size := octet_length(convert_to(original_text,'UTF8'));
  entry := jsonb_build_object('external_id','conversation','artifact_id',null,'expected_revision_id',null,'path','Readable title [conversation]',
    'content',original_text,'metadata',jsonb_build_object('format','study-conversation/1','provider','chatgpt','offset_unit','utf8',
      'messages',jsonb_build_array(jsonb_build_object('id','message','role','user','start',octet_length(convert_to(E'# "😀"\n','UTF8')),'end',size)),
      'excluded',jsonb_build_object('thoughts',1),'redactions',0));
  batch := jsonb_build_array(entry);
  first_run := public.accept_conversation_import('89000000-0000-4000-8000-000000000001',batch);
  select id,current_revision_id into artifact_uuid,revision_uuid from public.source_artifacts where external_id='conversation';
  assert (select short_code='T001' from public.source_artifacts where id=artifact_uuid);
  entry := entry||jsonb_build_object('artifact_id',artifact_uuid,'expected_revision_id',revision_uuid);
  second_run := public.accept_conversation_import('89000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_set(entry,'{metadata,excluded,thoughts}','2')));
  assert (select count(*)=1 from public.source_revisions where artifact_id=artifact_uuid);
  assert (select conversation_metadata->'excluded'->>'thoughts'='1' from public.source_import_items where import_id=first_run);
  assert (select conversation_metadata->'excluded'->>'thoughts'='2' from public.source_import_items where import_id=second_run);
  begin
    perform public.accept_conversation_import('89000000-0000-4000-8000-000000000001',batch);
    assert false,'Stale initial preview cannot overwrite existing state';
  exception when serialization_failure then null; end;
  changed_entry := jsonb_set(entry,'{content}',to_jsonb(replace(original_text,'π 😀','π 😀 updated')));
  changed_entry := jsonb_set(changed_entry,'{metadata,messages,0,end}',to_jsonb(octet_length(convert_to(changed_entry->>'content','UTF8'))));
  perform public.accept_conversation_import('89000000-0000-4000-8000-000000000001',jsonb_build_array(changed_entry));
  assert (select count(*)=2 from public.source_revisions where artifact_id=artifact_uuid);
  assert (select current_revision_id<>revision_uuid from public.source_artifacts where id=artifact_uuid);
  assert (select r.content=original_text from public.source_revisions r where r.id=revision_uuid);
  entry := entry||jsonb_build_object('expected_revision_id',(select current_revision_id from public.source_artifacts where id=artifact_uuid));
  begin
    perform public.accept_conversation_import('89000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_set(entry,'{metadata,messages,0,start}','0')));
    assert false,'Offsets must agree with the role-labelled text';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.accept_conversation_import('89000000-0000-4000-8000-000000000002',jsonb_build_array(entry));
    assert false,'An existing artifact cannot move between sources';
  exception when serialization_failure then null; end;
  entry := jsonb_set(jsonb_set(entry,'{metadata,provider}','"claude"'),'{artifact_id}','null');
  entry := jsonb_set(entry,'{expected_revision_id}','null');
  perform public.accept_conversation_import('89000000-0000-4000-8000-000000000002',jsonb_build_array(entry));
  assert (select count(*)=2 from public.source_artifacts where external_id='conversation');
  begin
    update public.source_import_items set conversation_metadata='{}';
    assert false,'Metadata cannot be rewritten directly';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000090',true);
do $$ begin
  assert not exists(select 1 from public.source_import_items);
  begin
    perform public.accept_conversation_import('89000000-0000-4000-8000-000000000001','[]');
    assert false,'Foreign source access must fail';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
