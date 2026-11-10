-- Run once in the Supabase SQL editor. All user data is protected by RLS.
create table public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  status text not null default 'not_started' check (status in ('not_started','studying','completed')),
  mastery smallint not null default 0 check (mastery between 0 and 5),
  reflection text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id),
  constraint progress_reflection_size check (char_length(reflection) <= 3000),
  constraint progress_lesson_id_size check (char_length(lesson_id) <= 120)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  title text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  unique(user_id, path),
  constraint note_path_size check (char_length(path) between 1 and 240),
  constraint note_title_size check (char_length(title) between 1 and 160),
  constraint note_body_size check (char_length(body) <= 500000)
);

create index notes_owner_updated_idx on public.notes(user_id, updated_at desc);

alter table public.lesson_progress enable row level security;
alter table public.notes enable row level security;

create policy "Owners manage lesson progress" on public.lesson_progress
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners manage notes" on public.notes
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The application sets user_id from the verified session, not from the browser.

-- Learning goals are separate for each account. Roadmap topics are derived from imported notes.
create table public.study_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  experience text not null default '',
  goals text not null default '',
  focus text not null default '',
  hours_per_week smallint not null default 5 check (hours_per_week between 1 and 80),
  updated_at timestamptz not null default now(),
  constraint experience_size check (char_length(experience) between 1 and 500),
  constraint goals_size check (char_length(goals) between 1 and 2000),
  constraint focus_size check (char_length(focus) <= 500)
);
alter table public.study_profiles enable row level security;
create policy "Owners manage study profile" on public.study_profiles
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
