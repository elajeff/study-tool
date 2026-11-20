begin;
create table public.download_budget (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('repository','library')),
  minute_start timestamptz not null,
  used integer not null,
  primary key (user_id,kind)
);
alter table public.download_budget enable row level security;
revoke all on public.download_budget from public,anon,authenticated;

create function public.allow_download(p_kind text) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  bucket timestamptz := date_trunc('minute',statement_timestamp());
  max_requests integer;
begin
  if owner_id is null then raise exception 'Sign in before downloading.' using errcode='42501'; end if;
  case p_kind
    when 'repository' then max_requests := 12;
    when 'library' then max_requests := 4;
    else raise exception 'Invalid download kind.' using errcode='22023';
  end case;

  insert into public.download_budget as budget(user_id,kind,minute_start,used)
    values(owner_id,p_kind,bucket,1)
    on conflict(user_id,kind) do update
      set minute_start=excluded.minute_start,
        used=case when budget.minute_start<excluded.minute_start then 1 else budget.used+1 end
      where budget.minute_start<excluded.minute_start
        or (budget.minute_start=excluded.minute_start and budget.used<max_requests);
  return found;
end;
$$;
revoke all on function public.allow_download(text) from public,anon;
grant execute on function public.allow_download(text) to authenticated;
commit;
