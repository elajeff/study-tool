begin;
-- Serialize saving a snapshot with removal of any collection referenced in it.
create function public.lock_export_sources() returns trigger
language plpgsql set search_path = '' as $$
declare source_id uuid;
begin
  for source_id in
    select (value->>'id')::uuid from jsonb_array_elements(new.manifest->'sources') order by 1
  loop
    perform 1 from public.sources s where s.user_id = new.user_id and s.id = source_id for key share;
    if not found then
      raise exception 'A collection was removed. Prepare the snapshot again.' using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.lock_export_sources() from public, anon, authenticated;
create trigger lock_export_sources before insert on public.library_exports
  for each row execute function public.lock_export_sources();

create function public.library_exports_using_source(p_source_id uuid)
returns table(id text, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select e.id, e.created_at from public.library_exports e
  where e.user_id = auth.uid()
    and e.manifest->'sources' @> jsonb_build_array(jsonb_build_object('id', p_source_id))
  order by e.id;
$$;
revoke all on function public.library_exports_using_source(uuid) from public, anon;
grant execute on function public.library_exports_using_source(uuid) to authenticated;

create function public.remove_library_source(p_source_id uuid, p_expected_exports text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  export_ids text[];
begin
  perform 1 from public.sources where id = p_source_id and user_id = owner_id for update;
  if not found then
    raise exception 'Collection not found in this account.' using errcode = '42501';
  end if;
  select array(select id from public.library_exports_using_source(p_source_id) order by id) into export_ids;
  if export_ids is distinct from p_expected_exports then
    raise exception 'The snapshot list changed. Reload this page and review it again.' using errcode = '40001';
  end if;

  delete from public.assessment_receipts receipt using public.course_steps step, public.course_modules module, public.courses course
    where receipt.user_id = owner_id and receipt.step_id = step.id and step.module_id = module.id
      and module.course_id = course.id and course.user_id = owner_id and course.export_id = any(export_ids);
  delete from public.library_exports where user_id = owner_id and id = any(export_ids);
  delete from public.notes where user_id = owner_id and source_id = p_source_id;
  delete from public.sources where user_id = owner_id and id = p_source_id;
end;
$$;
revoke all on function public.remove_library_source(uuid,text[]) from public, anon;
grant execute on function public.remove_library_source(uuid,text[]) to authenticated;
commit;
