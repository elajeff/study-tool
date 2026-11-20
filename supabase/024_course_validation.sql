begin;
create function public.check_course_outline() returns trigger
language plpgsql set search_path = '' as $$
declare
  outline jsonb := new.raw_block;
  entry jsonb;
  field text;
  item_id text;
  known text[];
  used text[] := array[]::text[];
  seen text[] := array[]::text[];
  omitted text[] := array[]::text[];
begin
  foreach field in array array['title', 'goal', 'target', 'assumed_level'] loop
    if jsonb_typeof(outline->field) is distinct from 'string' or outline->>field !~ '[^[:space:]]' then
      raise exception 'Course field % requires text.', field using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(outline->'not_covered') is distinct from 'array'
    or jsonb_typeof(outline->'open_questions') is distinct from 'array' then
    raise exception 'Course exclusions and questions must be lists.' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_array_elements(outline->'open_questions') q
      where jsonb_typeof(q) <> 'string' or q#>>'{}' !~ '[^[:space:]]') then
    raise exception 'Course questions require text.' using errcode = '22023';
  end if;

  select array(select item->>'id' from jsonb_array_elements(e.manifest->'items') item)
    into known from public.library_exports e where e.user_id = new.user_id and e.id = new.export_id;
  for entry in select value from jsonb_array_elements(outline->'modules') loop
    foreach field in array array['id', 'title', 'outcome', 'proof'] loop
      if jsonb_typeof(entry->field) is distinct from 'string' or entry->>field !~ '[^[:space:]]' then
        raise exception 'Module field % requires text.', field using errcode = '22023';
      end if;
    end loop;
    item_id := entry->>'id';
    if item_id = any(seen) or jsonb_typeof(entry->'needs') is distinct from 'array'
      or jsonb_typeof(entry->'sources') is distinct from 'array'
      or jsonb_typeof(entry->'steps_estimate') is distinct from 'number' then
      raise exception 'Invalid module: %.', item_id using errcode = '22023';
    end if;
    if exists(select 1 from jsonb_array_elements(entry->'needs') n
        where jsonb_typeof(n) <> 'string' or not (n#>>'{}' = any(seen))) then
      raise exception 'Module prerequisites must appear earlier.' using errcode = '22023';
    end if;
    if jsonb_array_length(entry->'sources') = 0 or exists(
        select 1 from jsonb_array_elements(entry->'sources') s
        where jsonb_typeof(s) <> 'string' or not (s#>>'{}' = 'general' or s#>>'{}' = any(known))) then
      raise exception 'Module cites an unknown Library item.' using errcode = '22023';
    end if;
    if (entry->>'steps_estimate')::numeric not between 1 and 9007199254740991
      or mod((entry->>'steps_estimate')::numeric, 1) <> 0 then
      raise exception 'Lesson estimate must be a positive integer.' using errcode = '22023';
    end if;
    seen := array_append(seen, item_id);
    used := used || array(select jsonb_array_elements_text(entry->'sources'));
  end loop;

  for entry in select value from jsonb_array_elements(outline->'not_covered') loop
    item_id := entry->>'id';
    if jsonb_typeof(entry->'id') is distinct from 'string' or not (item_id = any(known))
      or item_id = any(used) or item_id = any(omitted)
      or jsonb_typeof(entry->'why') is distinct from 'string' or entry->>'why' !~ '[^[:space:]]' then
      raise exception 'An exclusion needs a known, unused item and a reason.' using errcode = '22023';
    end if;
    omitted := array_append(omitted, item_id);
  end loop;
  return new;
end;
$$;
revoke all on function public.check_course_outline() from public, anon, authenticated;
create trigger check_course_outline before insert on public.courses
  for each row execute function public.check_course_outline();
commit;
