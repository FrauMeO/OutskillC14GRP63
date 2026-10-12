// Runs ONE case from cases.json through the app's real safety checks (the same code that ships).
// Shared by run-against-checker.mjs (the report) and tests-safety/cases.test.ts (the CI gate).
import {
  cleanReply, cleanCoachReply, isHardDay, isHardWeek, describeGoals, userMessage,
} from '../supabase/functions/daily-reflection/logic.ts';

export function runCase(c) {
  const e = c.expect;
  if (c.kind === 'reply' || c.kind === 'coachReply') {
    const text = c.repeat ? c.input.repeat(c.repeat) : c.input;
    const out = (c.kind === 'reply' ? cleanReply : cleanCoachReply)(text);
    const got = out === null ? 'reject' : 'pass';
    return { ok: got === e.reply, got, want: e.reply };
  }
  if (c.kind === 'day') {
    if ('hardDay' in e) {
      const got = isHardDay(c.input);
      return { ok: got === e.hardDay, got: `hardDay=${got}`, want: `hardDay=${e.hardDay}` };
    }
    // Same text the model would receive: the user message for that day.
    const sent = userMessage(c.input);
    const hit = new RegExp(e.promptMustNotMatch, 'i').exec(sent);
    return { ok: !hit, got: hit ? `sent contains "${hit[0]}"` : 'clean', want: `must not match /${e.promptMustNotMatch}/` };
  }
  if (c.kind === 'goals') {
    const sent = describeGoals(c.input).join('\n');
    const hit = new RegExp(e.promptMustNotMatch, 'i').exec(sent);
    return { ok: !hit, got: hit ? `sent contains "${hit[0]}"` : 'clean', want: `must not match /${e.promptMustNotMatch}/` };
  }
  if (c.kind === 'week') {
    const got = isHardWeek(c.input);
    return { ok: got === e.hardWeek, got: `hardWeek=${got}`, want: `hardWeek=${e.hardWeek}` };
  }
  throw new Error(`unknown kind ${c.kind}`);
}
