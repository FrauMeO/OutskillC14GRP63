-- Sign-up asks for one name (not traceable) and the month and year of birth only (never a day).
-- Birth month and year decide the plan (free from 60; see src/lib/signup.ts). Additive columns plus
-- the sign-up trigger; existing rows are untouched (both birth columns stay null for them).
--  profiles.full_name   still the column, now holds ONE display name, at most 40 characters
--  profiles.birth_month 1-12;  profiles.birth_year 1900..current year;  both set or both null
--  Under 16 is refused (the privacy policy says the service is not for under-16s).

alter table public.profiles
  add column birth_month smallint check (birth_month between 1 and 12),
  add column birth_year  smallint check (birth_year between 1900 and 2100),
  add constraint profiles_birth_both_or_neither check ((birth_month is null) = (birth_year is null));

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
  bm   int;
  byr  int;
begin
  if meta ->> 'home_latitude'  ~ '^-?[0-9]+(\.[0-9]+)?$' then lat := round((meta ->> 'home_latitude')::numeric, 1); end if;
  if meta ->> 'home_longitude' ~ '^-?[0-9]+(\.[0-9]+)?$' then lon := round((meta ->> 'home_longitude')::numeric, 1); end if;
  if lat is not null and lat not between -90 and 90 then lat := null; end if;
  if lon is not null and lon not between -180 and 180 then lon := null; end if;
  if cc !~ '^[A-Z]{2}$' then cc := null; end if;

  if meta ->> 'birth_month' ~ '^[0-9]{1,2}$' then bm := (meta ->> 'birth_month')::int; end if;
  if meta ->> 'birth_year'  ~ '^[0-9]{4}$'   then byr := (meta ->> 'birth_year')::int; end if;
  if bm is not null and bm not between 1 and 12 then bm := null; end if;
  if byr is not null and byr not between 1900 and extract(year from current_date)::int then byr := null; end if;
  if bm is null or byr is null then bm := null; byr := null; end if;
  if byr is not null and make_date(byr, bm, 1) > (current_date - interval '16 years') then
    raise exception 'You must be 16 or older to use Build Your Pillars.' using errcode = '22023';
  end if;

  insert into public.profiles (id, full_name, home_city, home_country_code, home_latitude, home_longitude,
                               marketing_opt_in, marketing_opt_in_at, health_consent_at, birth_month, birth_year)
  values (
    new.id,
    nullif(left(btrim(meta ->> 'full_name'), 40), ''),
    nullif(meta ->> 'home_city', ''),
    cc,
    lat,
    lon,
    coalesce(mkt, false),
    case when mkt then now() end,
    case when hc then now() end,
    bm,
    byr
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
