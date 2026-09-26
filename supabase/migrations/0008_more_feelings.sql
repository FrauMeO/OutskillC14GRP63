-- Thirteen feelings (Miah and Bob, 2026-09-26): adds hopeful, proud, steady, meh, anxious, lonely and
-- tired to the six from 0005. Loosens the rule only (a superset of 0005's list), so every saved
-- value stays valid. Stored words are the app's own; src/lib/checkin.ts maps each to an Apple
-- Health State of Mind label (steady -> content, meh -> indifferent, tired -> drained).

alter table public.habit_logs drop constraint habit_logs_feelings_check;

alter table public.habit_logs
  add constraint habit_logs_feelings_check check (
    feelings <@ array[
      'calm', 'peaceful', 'confident', 'grateful', 'hopeful', 'proud',
      'steady', 'meh',
      'frustrated', 'overwhelmed', 'anxious', 'lonely', 'tired'
    ]
    and public.array_has_no_duplicates(feelings)
  );
