-- Hackathon (temporary, with the AI reflection): a per-person choice between a reflection written
-- when asked and one written automatically after each log. Team feedback: success criterion 1.3
-- says the AI summary updates after each log; Miah chose to let each person decide (2026-09-26).
-- Additive only. Off by default, so nothing is sent to AI unless the person turns it on.
-- The existing profiles_update_own policy already limits changes to the person's own row.
alter table public.profiles
  add column auto_reflection boolean not null default false;
