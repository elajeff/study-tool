-- Run with psql after all migrations, against a disposable development database.
-- Fixtures and all imports are rolled back, including when an assertion fails.
\set ON_ERROR_STOP on
begin;
-- Allow the fixture to create records in the format used before origin and context tracking.
grant execute on function public.accept_source_import(uuid,jsonb) to authenticated;
set local plpgsql.check_asserts = on;

insert into auth.users(id, email) values
  ('00000000-0000-4000-8000-000000000001', 'source-test-a@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'source-test-b@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
insert into public.sources(id, user_id, kind, name) values
  ('10000000-0000-4000-8000-000000000001', auth.uid(), 'chatgpt', 'Collection A1'),
  ('10000000-0000-4000-8000-000000000002', auth.uid(), 'chatgpt', 'Collection A2');

-- Content equality does not establish identity. Updates and reliable renames do.
do $$
declare
  source_a uuid := '10000000-0000-4000-8000-000000000001';
  artifact_a uuid;
  original_revision uuid;
begin
  perform public.accept_source_import(source_a,
    '[{"external_id":"file-1","path":"README.md","content":"one"}]');
  select id, current_revision_id into artifact_a, original_revision
    from public.source_artifacts where source_id = source_a;
  perform set_config('test.artifact_a', artifact_a::text, true);
  perform public.accept_source_import('10000000-0000-4000-8000-000000000002',
    '[{"path":"README.md","content":"one"}]');
  assert (select count(distinct id) = 2 from public.source_artifacts where path = 'README.md');

  perform public.accept_source_import(source_a,
    '[{"external_id":"file-1","path":"README.md","content":"one"}]');
  assert (select count(*) = 1 from public.source_revisions where artifact_id = artifact_a);
  perform public.accept_source_import(source_a,
    '[{"external_id":"file-1","path":"docs/README.md","content":"two"}]');
  assert (select path = 'docs/README.md' from public.source_artifacts where id = artifact_a);
  assert (select count(*) = 2 from public.source_revisions where artifact_id = artifact_a);
  perform public.accept_source_import(source_a,
    '[{"external_id":"file-1","content":"one"},{"path":"copy.md","content":"one"}]');
  assert (select current_revision_id = original_revision from public.source_artifacts where id = artifact_a);
  assert (select count(*) = 2 from public.source_artifacts where source_id = source_a);
  assert (select count(*) = 2 from public.source_revisions where artifact_id = artifact_a);
  assert (select count(*) = 4 from public.source_import_items where artifact_id = artifact_a);

  -- A path-only rename requires the known artifact ID; it must not use content matching.
  perform public.accept_source_import(source_a, jsonb_build_array(jsonb_build_object(
    'artifact_id', (select id from public.source_artifacts where source_id = source_a and path = 'copy.md'),
    'path', 'renamed.md', 'content', 'one')));
  assert (select count(*) = 2 from public.source_artifacts where source_id = source_a);
end $$;

-- Reject malformed identities and oversized requests before publishing any records.
do $$
declare
  source_a uuid := '10000000-0000-4000-8000-000000000001';
  entry jsonb;
  batch jsonb;
  imports_before bigint := (select count(*) from public.source_imports);
begin
  for entry in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('external_id', 42, 'content', 'invalid ID'),
    jsonb_build_object('path', false, 'content', 'invalid path'),
    jsonb_build_object('external_id', repeat('x', 1025), 'content', 'long ID'),
    jsonb_build_object('path', repeat('x', 1025), 'content', 'long path'),
    jsonb_build_object('path', 'too-large.md', 'content', repeat('x', 500001)))) loop
    begin
      perform public.accept_source_import(source_a, jsonb_build_array(entry));
      assert false, 'Invalid input must reject the import';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  select jsonb_agg(jsonb_build_object('external_id', n::text, 'content', repeat('x', 500000)))
    into batch from generate_series(1, 74) n;
  begin
    perform public.accept_source_import(source_a, batch);
    assert false, 'An oversized batch must be rejected even below the entry-count limit';
  exception when invalid_parameter_value then null;
  end;
  assert (select count(*) from public.source_imports) = imports_before;
end $$;

-- A conflict in a later entry must undo earlier entries and the accepted-run record.
do $$
declare
  source_a uuid := '10000000-0000-4000-8000-000000000001';
  before_state jsonb;
begin
  select jsonb_build_array(
    (select jsonb_agg(a order by id) from public.source_artifacts a),
    (select jsonb_agg(r order by id) from public.source_revisions r),
    (select jsonb_agg(i order by id) from public.source_imports i),
    (select jsonb_agg(i order by import_id, artifact_id) from public.source_import_items i)) into before_state;
  begin
    perform public.accept_source_import(source_a,
      '[{"external_id":"file-1","content":"must roll back"},{"external_id":"unknown-key","path":"renamed.md","content":"one"}]');
    assert false, 'An unknown external ID must not silently claim an existing path';
  exception when unique_violation then null;
  end;
  assert before_state = jsonb_build_array(
    (select jsonb_agg(a order by id) from public.source_artifacts a),
    (select jsonb_agg(r order by id) from public.source_revisions r),
    (select jsonb_agg(i order by id) from public.source_imports i),
    (select jsonb_agg(i order by import_id, artifact_id) from public.source_import_items i));
  begin
    perform public.accept_source_import(source_a, '[{"path":"incomplete.md"}]');
    assert false, 'Missing text must reject the import';
  exception when invalid_parameter_value then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
insert into public.sources(id, user_id, kind, name) values
  ('20000000-0000-4000-8000-000000000001', auth.uid(), 'chatgpt', 'Export B');

-- RLS isolates every new table; the publishing function also checks source and artifact ownership.
do $$
declare
  table_name text;
  visible_rows bigint;
begin
  foreach table_name in array array['sources','source_artifacts','source_revisions','source_imports','source_import_items'] loop
    execute format('select count(*) from public.%I where user_id = $1', table_name)
      into visible_rows using '00000000-0000-4000-8000-000000000001'::uuid;
    assert visible_rows = 0, 'Another account can read ' || table_name;
  end loop;
  perform public.accept_source_import('20000000-0000-4000-8000-000000000001',
    '[{"external_id":"conversation-1","content":"own text"}]');
  begin
    perform public.accept_source_import('10000000-0000-4000-8000-000000000001',
      '[{"path":"foreign.md","content":"forbidden"}]');
    assert false, 'A foreign source must be rejected';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.accept_source_import('20000000-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object('artifact_id', current_setting('test.artifact_a'), 'content', 'forbidden')));
    assert false, 'A foreign artifact must be rejected';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.sources(user_id, kind, name) values ('00000000-0000-4000-8000-000000000001', 'obsidian', 'forbidden');
    assert false, 'An owner cannot be spoofed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.source_revisions set content = 'rewritten history';
    assert false, 'Even an owner cannot rewrite revisions';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.source_artifacts;
    assert false, 'Direct artifact deletion must be rejected';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.sources;
    assert false, 'Anonymous reads must be rejected';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.accept_source_import('20000000-0000-4000-8000-000000000001', '[]');
    assert false, 'Anonymous imports must be rejected';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
-- Composite foreign keys reject cross-owner/source references even when RLS is bypassed.
do $$
begin
  begin
    insert into public.source_artifacts(user_id, source_id, path) values
      ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'forbidden.md');
    assert false, 'Artifact owner must match source owner';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.source_artifacts set current_revision_id = (
      select current_revision_id from public.source_artifacts where source_id = '20000000-0000-4000-8000-000000000001')
      where id = current_setting('test.artifact_a')::uuid;
    assert false, 'Current revision must belong to this artifact and owner';
  exception when foreign_key_violation then null;
  end;
end $$;
rollback;
\echo 'PASS: source identity, revisions, atomic failure, ownership, and anonymous access'
