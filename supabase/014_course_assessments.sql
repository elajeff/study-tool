begin;
alter table public.assessment_receipts add column step_id uuid;
alter table public.assessment_receipts add constraint assessment_step_owner_fk
  foreign key(user_id,step_id) references public.course_steps(user_id,id) on delete set null(step_id);
alter table public.assessment_receipts add constraint assessment_step_topic
  check(step_id is null or topic='course-step:'||step_id::text);
create index assessment_receipts_step_idx on public.assessment_receipts(user_id,step_id) where step_id is not null;
commit;
