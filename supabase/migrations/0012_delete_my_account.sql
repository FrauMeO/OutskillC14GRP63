-- Self-service account deletion (GDPR Art. 17, App Store guideline 5.1.1(v)).
-- Additive: one function. A signed-in person deletes their own auth user; every table that holds
-- their data references auth.users with ON DELETE CASCADE (profiles, goals, habit_logs,
-- daily_conditions, reflections, care_shares as owner and as viewer), so everything goes with it.
-- It can only ever delete the caller: there is no id argument.

create or replace function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
