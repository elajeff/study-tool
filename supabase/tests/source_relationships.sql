-- Run after migration 005 on a disposable development database.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
insert into auth.users(id,email) values
  ('00000000-0000-4000-8000-000000000041','connections-a@example.test'),
  ('00000000-0000-4000-8000-000000000042','connections-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000041',true);
insert into public.sources(id,user_id,kind,name) values
  ('90000000-0000-4000-8000-000000000001',auth.uid(),'obsidian','Connections A'),
  ('90000000-0000-4000-8000-000000000002',auth.uid(),'obsidian','Other vault');
do $$
declare
  src uuid := '90000000-0000-4000-8000-000000000001';
  file_id uuid;
  original_revision uuid;
  entry jsonb;
begin
  perform public.accept_obsidian_import(src,'[{"artifact_id":null,"expected_path":null,"expected_revision_id":null,"expected_note_hash":null,"path":"Basics.md","content":"# Basics","decision":"replace"}]');
  perform public.accept_obsidian_import('90000000-0000-4000-8000-000000000002','[{"artifact_id":null,"expected_path":null,"expected_revision_id":null,"expected_note_hash":null,"path":"Basics.md","content":"# Other vault","decision":"replace"}]');
  select artifact_id,revision_id into file_id,original_revision from public.vault_import_state(src,array['Basics.md']);
  select jsonb_build_object('artifact_id',artifact_id,'expected_path',path,'expected_revision_id',revision_id,
    'expected_note_hash',note_hash,'path','Renamed.md','content','# Basics','decision','keep') into entry
    from public.vault_import_state(src,array['Basics.md']);
  perform public.accept_obsidian_import(src,jsonb_build_array(entry));
  assert (select current_path='Renamed.md' and current_revision_id=original_revision
    from public.source_path_aliases where artifact_id=file_id and path='Basics.md');
  assert (select count(distinct source_id)=2 from public.source_path_aliases where path='Basics.md');
  select jsonb_build_object('artifact_id',artifact_id,'expected_path',path,'expected_revision_id',revision_id,
    'expected_note_hash',note_hash,'path','Renamed.md','content','# Changed','decision','replace') into entry
    from public.vault_import_state(src,array['Renamed.md']);
  perform public.accept_obsidian_import(src,jsonb_build_array(entry));
  assert (select r.content='# Changed' from public.source_path_aliases a
    join public.source_revisions r on r.id=a.current_revision_id where a.artifact_id=file_id and a.path='Basics.md');
  assert (select content='# Basics' from public.source_revisions where id=original_revision);
  perform public.accept_obsidian_import(src,'[{"artifact_id":null,"expected_path":null,"expected_revision_id":null,"expected_note_hash":null,"path":"Basics.md","content":"# Reused path","decision":"replace"}]');
  assert (select count(distinct artifact_id)=2 from public.source_path_aliases where source_id=src and path='Basics.md');
  assert not has_table_privilege(current_user,'public.source_path_aliases','INSERT,UPDATE,DELETE');
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000042',true);
do $$
begin
  assert not exists(select 1 from public.source_path_aliases);
  assert not exists(select 1 from public.source_revisions);
end $$;
set local role anon;
do $$
begin
  begin
    perform 1 from public.source_path_aliases;
    assert false,'Anonymous alias reads must be denied';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
\echo 'PASS: source path history, current revisions and RLS'
