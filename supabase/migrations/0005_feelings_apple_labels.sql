-- Feelings now use six Apple Health State of Mind labels (HKStateOfMind.Label case names),
-- so a future importer can map Apple Health entries one to one.
-- Replaces the 0004 list (angry, sad, stable, happy, energized), which reversed a Prompt 3A choice.
-- Changing an allowed list is a tightening change: 0 rows had feelings when this was written.

alter table public.habit_logs drop constraint habit_logs_feelings_check;

-- Carry any existing values forward to their nearest new label.
update public.habit_logs
set feelings = (
  select array_agg(distinct case f
                     when 'angry'     then 'frustrated'
                     when 'sad'       then 'overwhelmed'
                     when 'stable'    then 'calm'
                     when 'happy'     then 'peaceful'
                     when 'energized' then 'confident'
                     else f
                   end)
  from unnest(feelings) as f
)
where feelings is not null;

alter table public.habit_logs
  add constraint habit_logs_feelings_check check (
    feelings <@ array['frustrated', 'overwhelmed', 'calm', 'peaceful', 'confident', 'grateful']
    and public.array_has_no_duplicates(feelings)
  );
