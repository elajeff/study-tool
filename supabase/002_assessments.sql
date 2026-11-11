-- Apply after schema.sql when upgrading from v0.1.
-- Existing self-reported progress is kept, but no longer used for mastery.
create table if not exists public.assessment_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  topic text not null,
  date date not null,
  level smallint not null check (level between 0 and 5),
  task text not null,
  evidence text not null,
  independent boolean not null,
  hints text not null check (hints in ('none', 'minor', 'major', 'solution')),
  artifact text not null default '',
  next_step text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id, fingerprint),
  constraint assessment_fields_size check (
    char_length(topic) between 1 and 240
    and char_length(task) between 1 and 3000
    and char_length(evidence) between 15 and 3000
    and char_length(artifact) <= 3000
    and char_length(next_step) <= 3000
  ),
  constraint independent_mastery check (
    level < 3 or (independent and hints in ('none', 'minor'))
  ),
  constraint project_mastery check (
    level < 4 or (hints = 'none' and char_length(trim(artifact)) > 0)
  )
);

create index if not exists assessment_receipts_owner_status_idx
  on public.assessment_receipts(user_id, status, date desc);

alter table public.assessment_receipts enable row level security;

create policy "Owners manage assessments" on public.assessment_receipts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
