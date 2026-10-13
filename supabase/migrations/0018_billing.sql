-- Billing (Miah, 2026-10-12). Additive only: four tables and several functions; nothing existing changes.
--
-- Rules this encodes:
--   * Free for anyone aged 60 or over (age from profiles.birth_month and birth_year only).
--   * $2.99 a month for everyone else ('standard_monthly').
--   * Caregiver plan $34.99 a year ('caregiver_yearly'), needed to VIEW a shared pillar view.
--   * BETA: app_settings.billing_enforced is false, so every function below answers "full access".
--     Flip it with a SQL statement run by Miah (see docs/billing.md). Clients can never write it.
--
-- Stripe is the source of truth for money. These tables are a read-only mirror, written only by the
-- stripe-webhook edge function using the service role. No card data is ever stored here.
-- Age is computed exactly as src/lib/signup.ts ageFrom does: whole years by calendar month,
-- counting a person as one year older from the START of their birth month. current_date is UTC
-- on Supabase, so a person can be counted a few hours early or late at a month boundary.

-- ---------- settings ----------
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "app_settings_select_authenticated" on public.app_settings
  for select to authenticated using (true);
revoke insert, update, delete on public.app_settings from anon, authenticated;
revoke all on public.app_settings from anon;
insert into public.app_settings (key, value) values ('billing_enforced', 'false'::jsonb)
  on conflict (key) do nothing;

-- ---------- Stripe customer per person ----------
create table public.customers (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);
alter table public.customers enable row level security;
create policy "customers_select_own" on public.customers
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.customers from anon, authenticated;
revoke all on public.customers from anon;

-- ---------- subscriptions (mirror of Stripe) ----------
create table public.subscriptions (
  stripe_subscription_id text primary key,
  user_id                uuid not null references auth.users (id) on delete cascade,
  plan                   text not null check (plan in ('standard_monthly', 'caregiver_yearly')),
  status                 text not null,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id);
alter table public.subscriptions enable row level security;
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke all on public.subscriptions from anon;

-- ---------- webhook idempotency (service role only: RLS on, no policies) ----------
create table public.stripe_events (
  event_id    text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

-- ---------- pure age helper (reveals nothing about any person) ----------
create or replace function public.plan_from_birth(p_month int, p_year int, p_today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_month is null or p_year is null then 'unknown'
    when extract(year from p_today)::int - p_year
         - (case when extract(month from p_today)::int < p_month then 1 else 0 end) >= 60 then 'free_60_plus'
    else 'standard'
  end;
$$;

-- ---------- plan_for: SERVER ONLY. Signed-in clients must not ask about other people. ----------
create or replace function public.plan_for(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.plan_from_birth(p.birth_month::int, p.birth_year::int, current_date)
       from public.profiles p where p.id = p_user),
    'unknown');
$$;

-- ---------- which Stripe statuses count as paid up (past_due does NOT; see docs/billing.md) ----------
create or replace function public.subscription_grants_access(p_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select coalesce(p_status in ('active', 'trialing'), false); $$;

-- ---------- my_entitlement: what the signed-in person may use ----------
-- status: beta | free | needs_birth | none | <latest Stripe status of the standard plan> | signed_out
create or replace function public.my_entitlement()
returns table (plan text, has_standard boolean, has_caregiver boolean, billing_enforced boolean, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  enforced boolean := coalesce((select s.value = 'true'::jsonb from public.app_settings s where s.key = 'billing_enforced'), false);
  v_plan text;
  std_status text;
begin
  if me is null then
    return query select 'unknown'::text, false, false, enforced, 'signed_out'::text;
    return;
  end if;
  v_plan := public.plan_for(me);

  if not enforced then
    -- Beta: everyone uses everything. Nothing is charged or blocked.
    return query select v_plan, true, true, false, 'beta'::text;
    return;
  end if;

  select s.status into std_status
    from public.subscriptions s
   where s.user_id = me and s.plan = 'standard_monthly'
   order by public.subscription_grants_access(s.status) desc, s.updated_at desc
   limit 1;

  return query select
    v_plan,
    (v_plan = 'free_60_plus') or public.subscription_grants_access(std_status),
    exists (select 1 from public.subscriptions s
             where s.user_id = me and s.plan = 'caregiver_yearly'
               and public.subscription_grants_access(s.status)
               and (s.current_period_end is null or s.current_period_end > now())),
    true,
    case
      when v_plan = 'free_60_plus' then 'free'
      when v_plan = 'unknown' then 'needs_birth'
      else coalesce(std_status, 'none')
    end;
end;
$$;

-- ---------- viewer_may_view: for the care-sharing functions to call (wire after 0015) ----------
create or replace function public.viewer_may_view(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and p_owner is not null
     and (
       not coalesce((select s.value = 'true'::jsonb from public.app_settings s where s.key = 'billing_enforced'), false)
       or exists (select 1 from public.subscriptions s
                   where s.user_id = auth.uid() and s.plan = 'caregiver_yearly'
                     and public.subscription_grants_access(s.status)
                     and (s.current_period_end is null or s.current_period_end > now()))
     );
$$;

-- ---------- legacy accounts: ask for birth month and year at next login ----------
create or replace function public.profile_birth_needed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and exists (select 1 from public.profiles p
                  where p.id = auth.uid() and (p.birth_month is null or p.birth_year is null));
$$;

-- ---------- privileges ----------
revoke all on function public.plan_from_birth(int, int, date) from public, anon;
revoke all on function public.plan_for(uuid) from public, anon, authenticated;
revoke all on function public.subscription_grants_access(text) from public, anon;
revoke all on function public.my_entitlement() from public, anon;
revoke all on function public.viewer_may_view(uuid) from public, anon;
revoke all on function public.profile_birth_needed() from public, anon;

grant execute on function public.plan_from_birth(int, int, date) to authenticated, service_role;
grant execute on function public.plan_for(uuid) to service_role;
grant execute on function public.subscription_grants_access(text) to authenticated, service_role;
grant execute on function public.my_entitlement() to authenticated;
grant execute on function public.viewer_may_view(uuid) to authenticated;
grant execute on function public.profile_birth_needed() to authenticated;
