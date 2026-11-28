begin;

create function public.create_profile_repository(p_name text,p_entries jsonb,p_origin jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  source_id uuid;
begin
  if owner_id is null then
    raise exception 'Sign in again.' using errcode='42501';
  end if;
  if p_origin->>'kind' is distinct from 'github' then
    raise exception 'Expected a GitHub repository.' using errcode='22023';
  end if;

  -- Concurrent profile imports may both have previewed this repository as new.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('library-source:'||owner_id::text,0));
  if exists(select 1 from public.source_imports
    where user_id=owner_id and lower(repository_origin->>'url')=lower(p_origin->>'url')) then
    raise exception 'This repository was already saved. Stop the import and review it again.' using errcode='40001';
  end if;

  insert into public.sources(user_id,kind,name) values(owner_id,'repository',p_name) returning id into source_id;
  return public.accept_repository_import(source_id,p_entries,p_origin);
end;
$$;

revoke all on function public.create_profile_repository(text,jsonb,jsonb) from public,anon;
grant execute on function public.create_profile_repository(text,jsonb,jsonb) to authenticated;

commit;
