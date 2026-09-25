-- Goals: one active goal per user per type, a fixed set of types, and sane target ranges.
-- The app enforces the same rules; these make them hold even if a request bypasses the UI.

alter table public.goals
  add constraint goals_goal_type_check
  check (goal_type in ('exercise', 'sleep', 'water'));

alter table public.goals
  add constraint goals_target_range_check
  check (
       (goal_type = 'exercise' and target_value between 1 and 600)
    or (goal_type = 'sleep'    and target_value between 1 and 24)
    or (goal_type = 'water'    and target_value > 0 and target_value <= 10)
  );

alter table public.goals
  add constraint goals_one_per_type unique (user_id, goal_type);

-- The unique index leads with user_id, so the separate user_id index is redundant.
drop index if exists public.goals_user_id_idx;
