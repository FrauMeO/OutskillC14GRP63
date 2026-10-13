// Rights requests (migration 0020, privacy_requests). Our promise is an answer within 30 days
// (Miah, 2026-10-12: stricter than Washington's 45). The database sets the real due date; this file
// only words things and checks the form before it is sent.

export const RESPONSE_DAYS = 30;
export const DETAILS_MAX = 2000;

export type RequestType = 'access' | 'delete' | 'correct' | 'restrict' | 'object' | 'withdraw' | 'list_third_parties' | 'appeal';

export const REQUEST_TYPES: { value: RequestType; label: string; needsDetails: boolean; hint: string }[] = [
  { value: 'access', label: 'See or get a copy of my information', needsDetails: false, hint: 'You can also download it yourself, any time, in "Your data" above.' },
  { value: 'list_third_parties', label: 'Find out who else gets my information', needsDetails: false, hint: 'The list is on this page. We can also send it to you in an email.' },
  { value: 'correct', label: 'Fix something that is wrong', needsDetails: true, hint: 'Tell us what is wrong and what you would like it to say.' },
  { value: 'delete', label: 'Delete my information', needsDetails: false, hint: 'You can also delete your whole account yourself, below.' },
  { value: 'withdraw', label: 'Take back a choice I made', needsDetails: false, hint: 'Most choices can be taken back with a button above.' },
  { value: 'restrict', label: 'Limit how you use my information', needsDetails: true, hint: 'Tell us what you want us to stop doing.' },
  { value: 'object', label: 'Object to how you use my information', needsDetails: true, hint: 'Tell us what you object to.' },
  { value: 'appeal', label: 'Appeal an answer you gave me', needsDetails: true, hint: 'Tell us which answer, and why you disagree.' },
];

export const isRequestType = (x: unknown): x is RequestType => REQUEST_TYPES.some((t) => t.value === x);

export const typeLabel = (t: string) => REQUEST_TYPES.find((r) => r.value === t)?.label ?? t;

/** null when fine, else a plain sentence for role="alert". */
export function validateRequest(type: string, details: string): string | null {
  if (!isRequestType(type)) return 'Please choose what you are asking for.';
  const text = details.trim();
  if (text.length > DETAILS_MAX) return `Please keep it to ${DETAILS_MAX} characters or fewer.`;
  const t = REQUEST_TYPES.find((r) => r.value === type);
  if (t?.needsDetails && text.length < 3) return 'Please tell us a little about your request.';
  return null;
}

/** "11 November 2026" in the person's language, from an ISO timestamp. */
export function formatDay(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

export type RequestRow = {
  id: string;
  request_type: string;
  details: string | null;
  status: 'open' | 'answered' | 'declined' | 'withdrawn' | string;
  created_at: string;
  due_at: string;
  extended_due_at: string | null;
  answered_at: string | null;
  outcome: string | null;
};

/** Whole days from now until the date, never below 0. */
export function daysLeft(dueIso: string, now: Date): number {
  const ms = new Date(dueIso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function requestStatusText(r: RequestRow, now: Date, locale?: string): string {
  if (r.status === 'answered') return `Answered${r.answered_at ? ` on ${formatDay(r.answered_at, locale)}` : ''}.`;
  if (r.status === 'declined') return `We could not do this. You can appeal by sending a new request of the type "Appeal".`;
  if (r.status === 'withdrawn') return 'You took this request back.';
  const due = r.extended_due_at ?? r.due_at;
  const left = daysLeft(due, now);
  const when = formatDay(due, locale);
  const extra = r.extended_due_at ? ' We asked for more time and told you why.' : '';
  return `Open. We will answer by ${when} (${left} ${left === 1 ? 'day' : 'days'} left).${extra}`;
}
