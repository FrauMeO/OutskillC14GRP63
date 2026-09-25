-- Stop the public API from calling rls_auto_enable().
-- Supabase adds this SECURITY DEFINER function to new projects; the event trigger
-- ensure_rls uses it to turn on RLS for new tables. Because it sits in the public
-- schema, anon and authenticated could also call it through /rest/v1/rpc/rls_auto_enable
-- (security advisor lints 0028 and 0029). Event triggers do not need EXECUTE on
-- their function, so revoking it leaves ensure_rls working.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
