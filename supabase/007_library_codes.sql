-- Stable reading references on the existing source identities. No source text changes.
begin;

alter table public.sources add column short_code text;
alter table public.source_artifacts add column short_code text;

with numbered as (
  select id, case kind when 'repository' then 'R' when 'chatgpt' then 'C' else 'V' end as prefix,
    row_number() over (partition by user_id,
      case kind when 'repository' then 'R' when 'chatgpt' then 'C' else 'V' end
      order by created_at, id) as n
  from public.sources
)
update public.sources s set short_code = n.prefix || n.n from numbered n where s.id = n.id;

with numbered as (
  select a.id, case s.kind when 'repository' then 'F' when 'chatgpt' then 'T' else 'N' end as prefix,
    row_number() over (partition by a.source_id order by a.id) as n
  from public.source_artifacts a join public.sources s on s.id = a.source_id
)
update public.source_artifacts a set short_code = n.prefix || lpad(n.n::text, greatest(3, length(n.n::text)), '0')
from numbered n where a.id = n.id;

alter table public.sources alter column short_code set not null,
  add constraint source_short_code_format check (short_code ~ '^[RVC][1-9][0-9]*$'),
  add constraint source_short_code_unique unique (user_id, short_code);
alter table public.source_artifacts alter column short_code set not null,
  add constraint artifact_short_code_format check (short_code ~ '^[FNT][0-9]{3,}$'),
  add constraint artifact_short_code_unique unique (source_id, short_code);

create function public.assign_source_short_code()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  prefix text := case new.kind when 'repository' then 'R' when 'chatgpt' then 'C' else 'V' end;
  n bigint;
begin
  -- Serialize allocation per owner; creating one source must not renumber another.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('library-source:' || new.user_id::text, 0));
  select coalesce(max(substring(short_code from 2)::bigint), 0) + 1 into n
    from public.sources where user_id = new.user_id and left(short_code, 1) = prefix;
  new.short_code := prefix || n;
  return new;
end;
$$;

create function public.assign_artifact_short_code()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  source_kind text;
  prefix text;
  n bigint;
begin
  -- The import publisher already takes this lock. Also protect other insertion paths.
  select kind into source_kind from public.sources
    where id = new.source_id and user_id = new.user_id for update;
  if not found then
    raise exception 'Artifact owner must match an existing source.' using errcode = '23503';
  end if;
  prefix := case source_kind when 'repository' then 'F' when 'chatgpt' then 'T' else 'N' end;
  select coalesce(max(substring(short_code from 2)::bigint), 0) + 1 into n
    from public.source_artifacts where source_id = new.source_id;
  new.short_code := prefix || lpad(n::text, greatest(3, length(n::text)), '0');
  return new;
end;
$$;

revoke all on function public.assign_source_short_code(), public.assign_artifact_short_code() from public, anon, authenticated;
create trigger source_short_code before insert on public.sources
  for each row execute function public.assign_source_short_code();
create trigger artifact_short_code before insert on public.source_artifacts
  for each row execute function public.assign_artifact_short_code();
commit;
