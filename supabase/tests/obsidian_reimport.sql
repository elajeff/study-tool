-- Run with psql after migration 004 on a disposable development database.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
insert into auth.users(id, email) values
  ('00000000-0000-4000-8000-000000000011', 'vault-a@example.test'),
  ('00000000-0000-4000-8000-000000000012', 'vault-b@example.test');
insert into public.sources(id,user_id,kind,name) values
  ('70000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','obsidian','Vault A'),
  ('70000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000011','obsidian','Vault A2'),
  ('70000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000011','legacy_notes','Legacy snapshot'),
  ('70000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000012','obsidian','Vault B');
insert into public.source_imports(id,user_id,source_id) values
  ('71000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','70000000-0000-4000-8000-000000000003');
insert into public.source_artifacts(id,user_id,source_id,path,legacy_topic) values
  ('72000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','70000000-0000-4000-8000-000000000003','Legacy.md','Lessons/Java/Legacy');
insert into public.source_revisions(id,user_id,source_id,artifact_id,import_id,content,content_hash) values
  ('73000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','70000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','Snapshot original',encode(sha256(convert_to('Snapshot original','UTF8')),'hex'));
update public.source_artifacts set current_revision_id='73000000-0000-4000-8000-000000000001' where id='72000000-0000-4000-8000-000000000001';
insert into public.notes(user_id,source_id,artifact_id,path,title,body) values
  ('00000000-0000-4000-8000-000000000011','70000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000001','Legacy.md','Legacy','Edited after snapshot');
insert into public.assessment_receipts(user_id,fingerprint,topic,date,level,task,evidence,independent,hints,status) values
  ('00000000-0000-4000-8000-000000000011','legacy-approved','Lessons/Java/Legacy','2026-11-12',3,'Write a method','Independent implementation and explanation',true,'none','approved');

-- Build the request tokens from the public preview RPC, without sharing acceptance logic.
create function pg_temp.preview_entry(src uuid, file_path text, body text, decision text)
returns jsonb language sql as $$
  select jsonb_build_object('path',file_path,'content',body,'decision',decision,
    'artifact_id',s.artifact_id,'expected_path',s.path,'expected_revision_id',s.revision_id,'expected_note_hash',s.note_hash)
  from (select 1) singleton left join public.vault_import_state(src,array[file_path]) s on s.path=file_path;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);

-- Separate vaults, identical reimports, and explicit renames keep identity and progress.
do $$
declare
  src uuid := '70000000-0000-4000-8000-000000000001';
  artifact uuid;
  note uuid;
  revision uuid;
begin
  perform public.accept_obsidian_import(src,jsonb_build_array(pg_temp.preview_entry(src,'Topic.md','Original','replace')));
  select artifact_id,id,imported_revision_id into artifact,note,revision from public.notes where source_id=src;
  perform set_config('test.vault_artifact',artifact::text,true);
  perform public.accept_obsidian_import('70000000-0000-4000-8000-000000000002',jsonb_build_array(
    pg_temp.preview_entry('70000000-0000-4000-8000-000000000002','Topic.md','Original','replace')));
  assert (select count(*)=2 from public.notes where path='Topic.md');
  perform public.accept_obsidian_import(src,jsonb_build_array(pg_temp.preview_entry(src,'Topic.md','Original','keep')));
  assert (select count(*)=1 from public.source_revisions where artifact_id=artifact);
  perform public.accept_obsidian_import(src,jsonb_build_array(
    pg_temp.preview_entry(src,'Topic.md','Original','keep') || '{"path":"Renamed.md"}'));
  assert (select id=note and artifact_id=artifact and imported_revision_id=revision and path='Renamed.md' from public.notes where id=note);
end $$;

-- Keeping local edits accepts the raw revision; stale local or source state rejects the whole batch.
do $$
declare
  src uuid := '70000000-0000-4000-8000-000000000001';
  entry jsonb;
  runs bigint;
begin
  update public.notes set body='Local edit',updated_at=clock_timestamp() where source_id=src;
  perform public.accept_obsidian_import(src,jsonb_build_array(pg_temp.preview_entry(src,'Renamed.md','Remote edit','keep')));
  assert (select body='Local edit' from public.notes where source_id=src);
  assert (select r.content='Remote edit' from public.notes n join public.source_revisions r on r.id=n.imported_revision_id where n.source_id=src);
  entry := pg_temp.preview_entry(src,'Renamed.md','Incoming','replace');
  update public.notes set body='Edited after preview',updated_at=clock_timestamp() where source_id=src;
  select count(*) into runs from public.source_imports where source_id=src;
  begin
    perform public.accept_obsidian_import(src,jsonb_build_array(pg_temp.preview_entry(src,'Must roll back.md','New','replace'),entry));
    assert false,'A stale note must reject the batch';
  exception when serialization_failure then null;
  end;
  assert (select count(*)=runs from public.source_imports where source_id=src);
  assert not exists(select 1 from public.source_artifacts where source_id=src and path='Must roll back.md');
  assert (select body='Edited after preview' from public.notes where source_id=src);
  entry := pg_temp.preview_entry(src,'Renamed.md','Incoming','replace');
  perform public.accept_obsidian_import(src,jsonb_build_array(pg_temp.preview_entry(src,'Renamed.md','Concurrent source revision','keep')));
  begin
    perform public.accept_obsidian_import(src,jsonb_build_array(entry));
    assert false,'A stale source revision must reject the batch';
  exception when serialization_failure then null;
  end;
end $$;

-- Vault publishing must not bypass preview validation or editable-note updates.
do $$
declare
  src uuid;
begin
  foreach src in array array['70000000-0000-4000-8000-000000000001'::uuid,'70000000-0000-4000-8000-000000000003'::uuid] loop
    begin
      perform public.accept_source_import(src,'[{"path":"Bypassed.md","content":"Must not publish"}]');
      assert false,'Direct raw imports into a vault must be denied';
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    perform public.publish_source_import('70000000-0000-4000-8000-000000000001','[{"path":"Bypassed.md","content":"Must not publish"}]');
    assert false,'Authenticated users must not call the internal publisher';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Legacy snapshots are unconfirmed, and deleting/restoring a note must not lose its old assessment alias.
do $$
declare
  src uuid := '70000000-0000-4000-8000-000000000003';
begin
  assert (select baseline_hash is null and note_body='Edited after snapshot' from public.vault_import_state(src,array['Legacy.md']));
  perform public.accept_obsidian_import(src,jsonb_build_array(pg_temp.preview_entry(src,'Legacy.md','Vault incoming','keep')));
  assert (select body='Edited after snapshot' from public.notes where source_id=src);
  delete from public.notes where source_id=src;
  perform public.accept_obsidian_import(src,jsonb_build_array(pg_temp.preview_entry(src,'Legacy.md','Restored source','replace')));
  assert (select legacy_topic='Lessons/Java/Legacy' from public.source_artifacts where source_id=src);
  assert (select count(*)=1 from public.assessment_receipts where topic='Lessons/Java/Legacy' and status='approved' and level=3);
  assert (select body='Restored source' from public.notes where source_id=src);
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',true);
do $$
begin
  assert not exists(select 1 from public.vault_import_state('70000000-0000-4000-8000-000000000001',array['Renamed.md']));
  begin
    perform public.accept_obsidian_import('70000000-0000-4000-8000-000000000001','[]');
    assert false,'Foreign vault write must be denied';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.accept_obsidian_import('70000000-0000-4000-8000-000000000004',jsonb_build_array(
      pg_temp.preview_entry('70000000-0000-4000-8000-000000000004','Foreign.md','Forbidden','replace')
      || jsonb_build_object('artifact_id',current_setting('test.vault_artifact'))));
    assert false,'Foreign artifact reference must be denied';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.notes set artifact_id=null;
    assert false,'Direct identity edits must be denied';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role anon;
do $$
begin
  begin
    perform public.vault_import_state('70000000-0000-4000-8000-000000000001',array['Renamed.md']);
    assert false,'Anonymous previews must be denied';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.accept_obsidian_import('70000000-0000-4000-8000-000000000001','[]');
    assert false,'Anonymous imports must be denied';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  begin
    update public.notes set user_id='00000000-0000-4000-8000-000000000012' where artifact_id=current_setting('test.vault_artifact')::uuid;
    assert false,'Note ownership must match artifact ownership even without RLS';
  exception when foreign_key_violation then null;
  end;
end $$;
rollback;
\echo 'PASS: vault identity, revisions, local edits, stale previews, legacy progress, and isolation'
