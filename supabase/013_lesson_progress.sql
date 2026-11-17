begin;
alter table public.course_steps add column completed_at timestamptz;
create policy "Owners update lesson progress" on public.course_steps for update to authenticated
  using(auth.uid()=user_id) with check(auth.uid()=user_id);
grant update(completed_at) on public.course_steps to authenticated;
commit;
