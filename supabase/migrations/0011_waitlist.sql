-- Waiting list for the App Store and Google Play apps. Additive only: one new table, one function.
-- Signed-out visitors can join through join_waitlist(); nobody can read the list from the browser.
-- Only the email address and which store(s) are kept. The function returns nothing, so it cannot
-- be used to find out whether an address is already on the list.

create table public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique
              check (email = lower(email) and length(email) <= 254
                     and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  want_ios     boolean not null default false,
  want_android boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (want_ios or want_android)
);

alter table public.waitlist enable row level security;
-- No policies: with row level security on and no policy, no browser role can read or write rows.
revoke all on public.waitlist from anon, authenticated;

create or replace function public.join_waitlist(p_email text, p_ios boolean, p_android boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    raise exception 'That does not look like an email address.' using errcode = '22023';
  end if;
  if not (coalesce(p_ios, false) or coalesce(p_android, false)) then
    raise exception 'Choose the App Store, Google Play, or both.' using errcode = '22023';
  end if;
  insert into public.waitlist (email, want_ios, want_android)
  values (v_email, coalesce(p_ios, false), coalesce(p_android, false))
  on conflict (email) do update
     set want_ios = public.waitlist.want_ios or excluded.want_ios,
         want_android = public.waitlist.want_android or excluded.want_android,
         updated_at = now();
end;
$$;

revoke all on function public.join_waitlist(text, boolean, boolean) from public;
grant execute on function public.join_waitlist(text, boolean, boolean) to anon, authenticated;
