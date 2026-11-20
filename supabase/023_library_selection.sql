begin;
alter table public.source_artifacts add column exclude_from_library boolean not null default false;
grant update(exclude_from_library) on public.source_artifacts to authenticated;
create policy "Owners change Library selection" on public.source_artifacts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;
