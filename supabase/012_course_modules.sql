begin;
alter table public.courses add constraint courses_owner_id_key unique(user_id,id);
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null,
  key text not null,
  unique(user_id,id), unique(course_id,key),
  foreign key(user_id,course_id) references public.courses(user_id,id) on delete cascade
);
create table public.course_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  module_id uuid not null,
  key text not null,
  position smallint not null check(position between 1 and 12),
  kind text not null check(kind in ('explain','example','trace','build','exercise','debug','interview','review')),
  goal text not null check(char_length(trim(goal)) between 1 and 3000),
  sources text[] not null check(cardinality(sources)>0),
  done_when text not null check(char_length(trim(done_when)) between 1 and 3000),
  unique(user_id,id), unique(module_id,key), unique(module_id,position),
  foreign key(user_id,module_id) references public.course_modules(user_id,id) on delete cascade
);
alter table public.course_modules enable row level security;
alter table public.course_steps enable row level security;
create policy "Owners read course modules" on public.course_modules for select to authenticated using(auth.uid()=user_id);
create policy "Owners read course steps" on public.course_steps for select to authenticated using(auth.uid()=user_id);
revoke all on public.course_modules,public.course_steps from public,anon,authenticated;
grant select on public.course_modules,public.course_steps to authenticated;

-- Keep lesson IDs stable by rejecting replacement plans.
create function public.save_course_module(p_course_id uuid, p_plan jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid := auth.uid(); outline jsonb; export_key text; manifest jsonb;
  module_key text := p_plan->>'module'; saved_module_id uuid;
  entry jsonb; canonical jsonb := '[]'; existing jsonb; position integer := 0;
begin
  select raw_block,export_id into outline,export_key from public.courses
    where id=p_course_id and user_id=owner_id for update;
  if not found then raise exception 'Course not found in this account.' using errcode='42501'; end if;
  if octet_length(p_plan::text)>300000 or p_plan->>'format' is distinct from 'study-module/1'
    or p_plan->>'course_id' is distinct from p_course_id::text or p_plan->>'export_id' is distinct from export_key
    or jsonb_typeof(p_plan->'steps') is distinct from 'array'
    or not exists(select 1 from jsonb_array_elements(outline->'modules') m where m->>'id'=module_key) then
    raise exception 'Module does not match the saved course and export.' using errcode='22023';
  end if;
  if jsonb_array_length(p_plan->'steps') not between 1 and 12 then
    raise exception 'Provide between 1 and 12 ordered steps.' using errcode='22023';
  end if;
  select e.manifest into manifest from public.library_exports e where e.user_id=owner_id and e.id=export_key;
  for entry in select value from jsonb_array_elements(p_plan->'steps') loop
    position := position+1;
    if entry->>'id' is distinct from module_key||'.S'||position
      or coalesce(entry->>'kind','') not in ('explain','example','trace','build','exercise','debug','interview','review')
      or jsonb_typeof(entry->'goal') is distinct from 'string' or char_length(trim(entry->>'goal')) not between 1 and 3000
      or jsonb_typeof(entry->'done_when') is distinct from 'string' or char_length(trim(entry->>'done_when')) not between 1 and 3000
      or jsonb_typeof(entry->'sources') is distinct from 'array' then
      raise exception 'Invalid lesson step.' using errcode='22023';
    end if;
    if jsonb_array_length(entry->'sources')=0 or exists(select 1 from jsonb_array_elements(entry->'sources') ref
      where jsonb_typeof(ref)<>'string' or (ref#>>'{}'<>'general' and not exists(
        select 1 from jsonb_array_elements(manifest->'items') item where item->>'id'=ref#>>'{}'))) then
      raise exception 'A step cites an unknown Library item.' using errcode='22023';
    end if;
    canonical := canonical||jsonb_build_array(jsonb_build_object('id',entry->'id','kind',entry->'kind',
      'goal',entry->'goal','sources',entry->'sources','done_when',entry->'done_when'));
  end loop;
  select id into saved_module_id from public.course_modules where course_id=p_course_id and key=module_key;
  if found then
    select jsonb_agg(jsonb_build_object('id',s.key,'kind',s.kind,'goal',s.goal,'sources',s.sources,'done_when',s.done_when) order by s.position)
      into existing from public.course_steps s where s.module_id=saved_module_id;
    if existing is distinct from canonical then
      raise exception 'This module already has a saved plan. Its steps and assessment links cannot be replaced.' using errcode='23505';
    end if;
    return saved_module_id;
  end if;
  insert into public.course_modules(user_id,course_id,key) values(owner_id,p_course_id,module_key) returning id into saved_module_id;
  position := 0;
  for entry in select value from jsonb_array_elements(canonical) loop
    position := position+1;
    insert into public.course_steps(user_id,module_id,key,position,kind,goal,sources,done_when)
      values(owner_id,saved_module_id,entry->>'id',position,entry->>'kind',entry->>'goal',
        array(select jsonb_array_elements_text(entry->'sources')),entry->>'done_when');
  end loop;
  return saved_module_id;
end;
$$;
revoke all on function public.save_course_module(uuid,jsonb) from public,anon;
grant execute on function public.save_course_module(uuid,jsonb) to authenticated;
commit;
