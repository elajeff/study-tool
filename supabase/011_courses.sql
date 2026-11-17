begin;
create table public.courses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  export_id text not null, raw_block jsonb not null,
  created_at timestamptz not null default now(),
  foreign key(user_id,export_id) references public.library_exports(user_id,id) on delete cascade,
  check ((raw_block->>'format'='study-course/1' and raw_block->>'export_id'=export_id and jsonb_typeof(raw_block->'modules')='array') is true)
);
create index courses_export_idx on public.courses(user_id,export_id);
alter table public.courses enable row level security;
create policy "Owners read courses" on public.courses for select to authenticated using(auth.uid()=user_id);
revoke all on public.courses from public,anon,authenticated;
grant select on public.courses to authenticated;

create function public.save_course(p_course jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner_id uuid := auth.uid(); saved_id uuid;
begin
  if p_course->>'format' is distinct from 'study-course/1' or octet_length(p_course::text)>1024*1024
    or jsonb_typeof(p_course->'modules') is distinct from 'array' then
    raise exception 'Invalid course object.' using errcode='22023';
  end if;
  if jsonb_array_length(p_course->'modules')=0 then raise exception 'A course needs modules.' using errcode='22023'; end if;
  if not exists(select 1 from public.library_exports where user_id=owner_id and id=p_course->>'export_id') then
    raise exception 'Course export not found in this account.' using errcode='42501';
  end if;
  -- Imports of an unchanged response reuse the course, including concurrent retries.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('study-inbox:'||owner_id::text,0));
  select id into saved_id from public.courses where user_id=owner_id and export_id=p_course->>'export_id'
    and raw_block=p_course order by created_at,id limit 1;
  if not found then
    insert into public.courses(user_id,export_id,raw_block) values(owner_id,p_course->>'export_id',p_course) returning id into saved_id;
  end if;
  return saved_id;
end;
$$;
revoke all on function public.save_course(jsonb) from public,anon;
grant execute on function public.save_course(jsonb) to authenticated;
commit;
