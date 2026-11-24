begin;
create function public.library_courses_using_source(p_source_id uuid)
returns table(id uuid, name text)
language sql stable security invoker set search_path = '' as $$
  select course.id, coalesce(course.display_name, course.raw_block->>'title', 'Untitled course')
  from public.courses course
  join public.library_exports_using_source(p_source_id) snapshot on snapshot.id = course.export_id
  where course.user_id = auth.uid()
  order by course.id;
$$;
revoke all on function public.library_courses_using_source(uuid) from public, anon;
grant execute on function public.library_courses_using_source(uuid) to authenticated;

drop function public.remove_library_source(uuid,text[]);
create function public.remove_library_source(p_source_id uuid, p_expected_exports text[], p_expected_courses uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  export_ids text[];
begin
  -- Course imports take the same account lock before saving new courses.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('study-inbox:'||owner_id::text,0));
  perform 1 from public.sources where id = p_source_id and user_id = owner_id for update;
  if not found then
    raise exception 'Collection not found in this account.' using errcode = '42501';
  end if;
  select array(select id from public.library_exports_using_source(p_source_id) order by id) into export_ids;
  if export_ids is distinct from p_expected_exports then
    raise exception 'The snapshot list changed. Reload this page and review it again.' using errcode = '40001';
  end if;

  if array(select id from public.library_courses_using_source(p_source_id) order by id) is distinct from p_expected_courses then
    raise exception 'The course list changed. Reload this page and review it again.' using errcode = '40001';
  end if;

  delete from public.assessment_receipts receipt using public.course_steps step, public.course_modules module, public.courses course
    where receipt.user_id = owner_id and receipt.step_id = step.id and step.module_id = module.id
      and module.course_id = course.id and course.user_id = owner_id and course.export_id = any(export_ids);
  delete from public.library_exports where user_id = owner_id and id = any(export_ids);
  delete from public.notes where user_id = owner_id and source_id = p_source_id;
  delete from public.sources where user_id = owner_id and id = p_source_id;
end;
$$;
revoke all on function public.remove_library_source(uuid,text[],uuid[]) from public, anon;
grant execute on function public.remove_library_source(uuid,text[],uuid[]) to authenticated;
commit;
