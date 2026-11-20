begin;
alter table public.courses add column chat_url text
  check (chat_url ~ '^https://chatgpt[.]com/(g/[a-zA-Z0-9-]{1,160}/)?c/[a-zA-Z0-9-]{1,100}$');
grant update(chat_url) on public.courses to authenticated;
create policy "Owners change their course chat link" on public.courses for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;
