begin;

alter table public.courses add column display_name text
  check (display_name is null or (char_length(display_name) <= 160 and display_name ~ '[^[:space:]]'));
grant update(display_name) on public.courses to authenticated;

create function public.delete_course(p_course_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  perform 1 from public.courses where id = p_course_id and user_id = owner_id for update;
  if not found then
    raise exception 'Course not found in this account.' using errcode = '42501';
  end if;

  -- Prevent a new assessment from referencing a step while its course is being removed.
  perform 1 from public.course_steps step join public.course_modules module on module.id = step.module_id
    where module.course_id = p_course_id and module.user_id = owner_id for update of step;
  delete from public.assessment_receipts receipt using public.course_steps step, public.course_modules module
    where receipt.user_id = owner_id and receipt.step_id = step.id and step.module_id = module.id
      and module.course_id = p_course_id and module.user_id = owner_id;
  delete from public.courses where id = p_course_id and user_id = owner_id;
end;
$$;
revoke all on function public.delete_course(uuid) from public, anon;
grant execute on function public.delete_course(uuid) to authenticated;

commit;
