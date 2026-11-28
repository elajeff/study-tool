begin;

create or replace function public.accept_repository_import(p_source_id uuid,p_entries jsonb,p_origin jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare run_id uuid; previous_url text;
begin
  perform 1 from public.sources where id=p_source_id and user_id=auth.uid() and kind='repository' for update;
  if not found then
    raise exception 'Repository not found in this account.' using errcode='42501';
  end if;
  if p_origin->>'format' is distinct from 'study-repository/1' or coalesce(p_origin->>'kind','') not in ('github','archive')
    or jsonb_typeof(p_origin->'excluded') is distinct from 'array' or octet_length(p_origin::text)>1024*1024
    or (p_origin - array['format','kind','url','commit','excluded'])<>'{}'::jsonb then
    raise exception 'Invalid repository origin.' using errcode='22023';
  end if;
  if jsonb_array_length(p_origin->'excluded')>4000 or exists(select 1 from jsonb_array_elements(p_origin->'excluded') item
    where jsonb_typeof(item)<>'string' or octet_length(item::text)>2048) then
    raise exception 'Invalid excluded paths.' using errcode='22023';
  end if;
  if p_origin->>'kind'='github' then
    if jsonb_typeof(p_origin->'url') is distinct from 'string' or jsonb_typeof(p_origin->'commit') is distinct from 'string'
      or coalesce(p_origin->>'url','')!~'^https://github[.]com/[A-Za-z0-9-]+/[A-Za-z0-9_.-]+$'
      or coalesce(p_origin->>'commit','')!~'^[a-fA-F0-9]{40}$' then raise exception 'Invalid GitHub snapshot.' using errcode='22023'; end if;
    select repository_origin->>'url' into previous_url from public.source_imports
      where source_id=p_source_id and repository_origin->>'kind'='github'
      order by accepted_at desc,id desc limit 1;
    if previous_url is not null and lower(previous_url)<>lower(p_origin->>'url') then
      raise exception 'This collection already belongs to another GitHub repository. Choose a different collection.' using errcode='22023';
    end if;
  elsif p_origin->>'url' is not null or p_origin->>'commit' is not null then
    raise exception 'Local archives must leave the GitHub origin unknown.' using errcode='22023';
  end if;
  run_id := public.accept_source_import(p_source_id,p_entries);
  update public.source_imports set repository_origin=p_origin where id=run_id;
  return run_id;
end;
$$;
revoke all on function public.accept_repository_import(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.accept_repository_import(uuid,jsonb,jsonb) to authenticated;

commit;
