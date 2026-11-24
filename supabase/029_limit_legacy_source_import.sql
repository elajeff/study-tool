begin;
-- Repository imports still use this helper inside accept_repository_import.
revoke execute on function public.accept_source_import(uuid,jsonb) from authenticated;
commit;
