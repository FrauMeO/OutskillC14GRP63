-- Opt-in consent for email and for processing health data (GDPR Arts. 6, 7 and 9).
-- Additive columns plus two function changes; every existing row and call keeps working except
-- join_waitlist, which now needs an explicit consent flag (the waitlist is new and empty).
--
-- profiles.marketing_opt_in      false until the person ticks the box (sign-up or Settings)
-- profiles.marketing_opt_in_at   when that choice was last made
-- profiles.health_consent_at     when they agreed to us processing their health information
-- waitlist.consent_at            when they agreed to be emailed about the app launch

alter table public.profiles
  add column marketing_opt_in    boolean not null default false,
  add column marketing_opt_in_at timestamptz,
  add column health_consent_at   timestamptz;

alter table public.waitlist add column consent_at timestamptz not null default now();

-- Sign-up copies the two choices from the sign-up form's metadata. Missing or anything other than
-- the string 'true' means no.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  lat  numeric;
  lon  numeric;
  cc   text := upper(meta ->> 'home_country_code');
  mkt  boolean := (meta ->> 'marketing_opt_in') = 'true';
  hc   boolean := (meta ->> 'health_consent') = 'true';
begin
  if meta ->> 'home_latitude'  ~ '^-?[0-9]+(\.[0-9]+)?$' then lat := round((meta ->> 'home_latitude')::numeric, 1); end if;
  if meta ->> 'home_longitude' ~ '^-?[0-9]+(\.[0-9]+)?$' then lon := round((meta ->> 'home_longitude')::numeric, 1); end if;
  if lat is not null and lat not between -90 and 90 then lat := null; end if;
  if lon is not null and lon not between -180 and 180 then lon := null; end if;
  if cc !~ '^[A-Z]{2}$' then cc := null; end if;

  insert into public.profiles (id, full_name, home_city, home_country_code, home_latitude, home_longitude,
                               marketing_opt_in, marketing_opt_in_at, health_consent_at)
  values (
    new.id,
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'home_city', ''),
    cc,
    lat,
    lon,
    coalesce(mkt, false),
    case when mkt then now() end,
    case when hc then now() end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- The waiting list now needs the person's explicit yes.
drop function public.join_waitlist(text, boolean, boolean);

create or replace function public.join_waitlist(p_email text, p_ios boolean, p_android boolean, p_consent boolean)
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
  if not coalesce(p_consent, false) then
    raise exception 'Please tick the box to agree to be emailed.' using errcode = '22023';
  end if;
  insert into public.waitlist (email, want_ios, want_android, consent_at)
  values (v_email, coalesce(p_ios, false), coalesce(p_android, false), now())
  on conflict (email) do update
     set want_ios = public.waitlist.want_ios or excluded.want_ios,
         want_android = public.waitlist.want_android or excluded.want_android,
         consent_at = now(),
         updated_at = now();
end;
$$;

revoke all on function public.join_waitlist(text, boolean, boolean, boolean) from public;
grant execute on function public.join_waitlist(text, boolean, boolean, boolean) to anon, authenticated;
