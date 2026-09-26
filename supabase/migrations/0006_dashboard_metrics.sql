-- Prompt 4: metrics for the dashboard cards, where each day's values came from, and goals for
-- the new goal-tracked metrics. Keeps one row per user per day.
-- Numbered 0006 because Prompt 3C (gentle check-in) is paused; its draft migration will be
-- renumbered to 0007 before it is applied.

-- ---------- habit_logs: new metrics (all nullable: blank means not logged) ----------
alter table public.habit_logs
  add column steps              int     check (steps between 0 and 200000),
  add column stand_hours        numeric check (stand_hours between 0 and 24),
  add column active_calories    int     check (active_calories between 0 and 20000),
  add column time_in_bed_hours  numeric check (time_in_bed_hours between 0 and 24),
  add column awake_minutes      int     check (awake_minutes between 0 and 1440),
  add column calories_consumed  int     check (calories_consumed between 0 and 20000),
  -- Where the day's values came from: an Apple Health import or the Log Habits form.
  -- Decides ring (apple_health) vs bar (manual) on the dashboard.
  add column source             text    not null default 'manual' check (source in ('apple_health', 'manual'));

-- ---------- goals: widen the allowed types and ranges (0 goal rows exist) ----------
-- Replaces the 0002 rules. This loosens them: every goal valid before is still valid.
alter table public.goals drop constraint goals_goal_type_check;
alter table public.goals drop constraint goals_target_range_check;

alter table public.goals
  add constraint goals_goal_type_check
  check (goal_type in ('exercise', 'sleep', 'water', 'steps', 'stand_hours', 'active_calories', 'calories_consumed'));

alter table public.goals
  add constraint goals_target_range_check
  check (
       (goal_type = 'exercise'          and target_value between 1 and 600)
    or (goal_type = 'sleep'             and target_value between 1 and 24)
    or (goal_type = 'water'             and target_value > 0 and target_value <= 10)
    or (goal_type = 'steps'             and target_value between 100 and 100000)
    or (goal_type = 'stand_hours'       and target_value between 1 and 24)
    or (goal_type = 'active_calories'   and target_value between 10 and 5000)
    or (goal_type = 'calories_consumed' and target_value between 500 and 10000)
  );
-- goals_one_per_type (unique user_id, goal_type) is unchanged.
