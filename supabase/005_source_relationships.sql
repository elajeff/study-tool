-- Reuse accepted path history; query with the caller's existing RLS permissions.
begin;
create view public.source_path_aliases with (security_invoker = true) as
  select a.user_id, a.source_id, a.id as artifact_id, a.path as current_path,
    a.current_revision_id, a.path
  from public.source_artifacts a where a.path is not null
  union
  select a.user_id, a.source_id, a.id, a.path, a.current_revision_id, i.path
  from public.source_artifacts a join public.source_import_items i on i.artifact_id = a.id
  where i.path is not null;
revoke all on public.source_path_aliases from public, anon, authenticated;
grant select on public.source_path_aliases to authenticated;
commit;
