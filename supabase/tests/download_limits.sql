\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts=on;
insert into auth.users(id,email) values
  ('00000000-0000-4000-8000-000000000090','download-a@example.test'),
  ('00000000-0000-4000-8000-000000000091','download-b@example.test');
insert into public.download_budget(user_id,kind,minute_start,used)
  values('00000000-0000-4000-8000-000000000090','library',now()-interval '2 minutes',4);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000090',true);
do $$ begin
  for request in 1..4 loop
    assert public.allow_download('library'),'A new window permits the normal allowance';
  end loop;
  assert not public.allow_download('library'),'The next Library download must wait';
  for request in 1..12 loop
    assert public.allow_download('repository'),'The Library budget must not block normal repository batches';
  end loop;
  assert not public.allow_download('repository'),'The next repository download must wait';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
do $$ begin
  assert public.allow_download('library'),'Another user has their own allowance';
end $$;
rollback;
