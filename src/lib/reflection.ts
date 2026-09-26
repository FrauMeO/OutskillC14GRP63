// Gentle check-in and reflection (Prompt 3C). Pure rules and approved words; the pages only
// display them. Wording and resources were approved by Miah on 2026-09-26
// (docs/development-log.md, section 9). Never use the word "screening" in anything shown.
//
// The questions are the PHQ-2 and PHQ-9 in their standard wording (Kroenke, Spitzer and Williams;
// free to use without permission). Changing a validated questionnaire changes what its scores
// mean, so only the framing around the questions uses reflection language.

// ---------- Questions ----------

export const QUESTION_INTRO = 'Over the last 2 weeks, how often have you been bothered by any of the following problems?';

export const PHQ9_ITEMS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself, or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading the newspaper or watching television',
  'Moving or speaking so slowly that other people could have noticed, or the opposite: being so fidgety or restless that you have been moving around a lot more than usual',
  'Thoughts that you would be better off dead, or of hurting yourself in some way',
] as const;

export const ANSWERS = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'] as const; // 0 to 3

export type Answer = 0 | 1 | 2 | 3;

export function phq2Score(a: (Answer | null)[]): number | null {
  const [one, two] = a;
  return one == null || two == null ? null : one + two;
}

// All nine answers are required: never a partial set.
export function phq9Score(a: (Answer | null)[]): number | null {
  if (a.length !== 9 || a.some((x) => x == null)) return null;
  return (a as Answer[]).reduce<number>((s, x) => s + x, 0);
}

export const PHQ2_FOLLOW_UP = 3; // offer the full reflection at 3 or more

// ---------- When to offer the gentle check-in ----------

export const WINDOW = 14; // last 14 logged days
export const HARDER_DAYS = 7; // at least 7 of them
export const COOLDOWN_DAYS = 14; // at most once per 14 days, counting every offer
// Most important rule (Miah, 2026-09-26): only offer after the data shows a real trend, collected
// as more than 10 sequential entries: an unbroken run of calendar days with a mood or stress
// check-in, ending today or yesterday.
export const MIN_SEQUENTIAL_ENTRIES = 11;

export type DayRow = { log_date: string; mood: number | null; stress: number | null };
export type OfferRow = { offered_on: string; taken_on: string | null };

export function isHarderDay(d: DayRow): boolean {
  return (d.mood !== null && d.mood <= 2) || (d.stress !== null && d.stress >= 4);
}

function hasCheckin(d: DayRow): boolean {
  return d.mood !== null || d.stress !== null;
}

// Length of the unbroken run of calendar days with a check-in, ending today or yesterday.
export function currentRun(days: DayRow[], todayIso: string): number {
  const withCheckin = new Set(days.filter(hasCheckin).map((d) => d.log_date));
  const back = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d) - 86_400_000);
    return t.toISOString().slice(0, 10);
  };
  let day = withCheckin.has(todayIso) ? todayIso : back(todayIso);
  let run = 0;
  while (withCheckin.has(day)) {
    run++;
    day = back(day);
  }
  return run;
}

function daysBetween(fromIso: string, toIso: string): number {
  const [a, b] = [fromIso, toIso].map((iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

export type CheckinState =
  | { show: false; reason: 'off' | 'not-enough-entries' | 'not-enough-harder-days' | 'offered-recently' }
  | { show: true; offerToday: OfferRow | null; harderDays: number };

// Show when the setting is on, there are more than 10 sequential days of check-ins ending today
// or yesterday, at least 7 of the last 14 logged days were harder days (mood 1 or 2, or stress 4
// or 5), and nothing was offered in the last 14 days. An offer made today that
// has not been taken keeps showing today, so the person can come back to it.
export function checkinState(opts: {
  enabled: boolean;
  days: DayRow[];
  offers: OfferRow[];
  todayIso: string;
}): CheckinState {
  if (!opts.enabled) return { show: false, reason: 'off' };
  const recent = [...opts.days].sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, WINDOW);
  const harderDays = recent.filter(isHarderDay).length;
  const latest = [...opts.offers].sort((a, b) => b.offered_on.localeCompare(a.offered_on))[0] ?? null;
  if (latest && latest.offered_on === opts.todayIso && !latest.taken_on) {
    return { show: true, offerToday: latest, harderDays };
  }
  if (latest && daysBetween(latest.offered_on, opts.todayIso) < COOLDOWN_DAYS) return { show: false, reason: 'offered-recently' };
  if (currentRun(opts.days, opts.todayIso) < MIN_SEQUENTIAL_ENTRIES) return { show: false, reason: 'not-enough-entries' };
  if (harderDays < HARDER_DAYS) return { show: false, reason: 'not-enough-harder-days' };
  return { show: true, offerToday: null, harderDays };
}

// ---------- Result tiers ----------

export type Tier = 'calm' | 'gentle' | 'support' | 'urgent';

// Above 6 is a cautious early prompt, deliberately below the usual cut-off of 10 (Miah).
export function tierFor(phq9: number): Tier {
  if (phq9 > 15) return 'urgent';
  if (phq9 > 10) return 'support';
  if (phq9 > 6) return 'gentle';
  return 'calm';
}

export const MESSAGES: Record<Tier | 'item9' | 'short', string> = {
  short:
    'Thank you for taking a moment to reflect. Talking with someone you trust, like a friend or family member, is always welcome, whenever you would like.',
  calm:
    'Thank you for taking a moment to reflect. Talking with someone you trust, like a friend or family member, is always welcome, whenever you would like.',
  gentle:
    "Thank you for taking a moment for yourself. Your answers suggest the last two weeks may have felt harder than usual. It can help to talk with someone you trust, like a friend or family member, about how you've been feeling. If you'd like more support, here's a place to start.",
  support:
    "Thank you for being honest with yourself. It sounds like things have been hard lately, and you don't have to carry that alone. Consider reaching out to a friend or someone close to you today, even just to say you've been having a tough time. A support line can also listen, confidentially and without judgment, any time you need it.",
  urgent:
    "Thank you for sharing this. It sounds like you've been going through a lot. Please consider talking with your doctor soon, and letting a friend or family member know how you're feeling, so you have people alongside you. You can also reach these services now.",
  item9:
    "You mentioned having thoughts of being better off dead or of hurting yourself. You deserve support right now. Please contact one of these services, or someone you trust who can be with you. If you're in immediate danger, call your emergency number.",
};

export const FOOTER = 'This is encouragement to reflect a little more deeply today. It is not medical advice.';

export const OFFER_TEXT =
  "You've logged several harder days lately. Would you like to take a few minutes to reflect on the last two weeks? It's optional, and only you can see your answers.";

// ---------- Resources by home country ----------

export type Resource = { key: string; name: string; detail: string; tel?: string; href?: string };

type Country = { national?: Resource; emergency: Resource; national24h: boolean };

const COUNTRIES: Record<string, Country> = {
  US: {
    national: { key: 'us-988', name: '988 Suicide & Crisis Lifeline', detail: 'Call or text 988. Free, confidential, any time.', tel: '988' },
    emergency: { key: 'us-911', name: 'Emergency', detail: 'Call 911 if you are in immediate danger.', tel: '911' },
    national24h: true,
  },
  CA: {
    national: { key: 'ca-988', name: '9-8-8 Suicide Crisis Helpline', detail: 'Call or text 988. Free, confidential, any time.', tel: '988' },
    emergency: { key: 'ca-911', name: 'Emergency', detail: 'Call 911 if you are in immediate danger.', tel: '911' },
    national24h: true,
  },
  IN: {
    national: { key: 'in-telemanas', name: 'Tele-MANAS', detail: 'Call 14416. Free, confidential, any time, in 20+ languages.', tel: '14416' },
    emergency: { key: 'in-112', name: 'Emergency', detail: 'Call 112 if you are in immediate danger.', tel: '112' },
    national24h: true,
  },
  DE: {
    national: {
      key: 'de-telefonseelsorge',
      name: 'TelefonSeelsorge',
      detail: 'Call 0800 111 0 111 or 0800 111 0 222. Free, confidential, any time, in German.',
      tel: '08001110111',
    },
    emergency: { key: 'de-112', name: 'Emergency', detail: 'Call 112 if you are in immediate danger.', tel: '112' },
    national24h: true,
  },
  AE: {
    national: {
      key: 'ae-800hope',
      name: '800 HOPE Mental Support Line',
      detail: 'Call 800 4673. Free and confidential, 8 am to 8 pm, in Arabic and English.',
      tel: '8004673',
    },
    emergency: { key: 'ae-999', name: 'Emergency', detail: 'Call 999 (police) or 998 (ambulance) if you are in immediate danger.', tel: '999' },
    national24h: false,
  },
};

export function findAHelpline(countryCode: string | null): Resource {
  const cc = countryCode?.toLowerCase();
  return {
    key: 'findahelpline',
    name: 'Find A Helpline',
    detail: 'Free, confidential support lines in your country, with filters for language and topic.',
    href: cc ? `https://findahelpline.com/countries/${cc}` : 'https://findahelpline.com/',
  };
}

const LOCAL_EMERGENCY: Resource = {
  key: 'local-emergency',
  name: 'Emergency',
  detail: 'Call your local emergency number if you are in immediate danger.',
};

// Resources for a result. Item 9 above 0 always comes first, whatever the total.
export function resourcesFor(countryCode: string | null, tier: Tier, item9: number | null): { crisis: Resource[]; tier: Resource[] } {
  const c = countryCode ? COUNTRIES[countryCode.toUpperCase()] : undefined;
  const helpline = findAHelpline(countryCode);
  const emergency = c?.emergency ?? LOCAL_EMERGENCY;

  let crisis: Resource[] = [];
  if (item9 !== null && item9 > 0) {
    if (c?.national && c.national24h) crisis = [c.national, emergency];
    else if (c?.national) crisis = [emergency, c.national]; // e.g. UAE: the line closes at night
    else crisis = [emergency, helpline];
  }

  let list: Resource[] = [];
  if (tier === 'gentle') list = [helpline];
  if (tier === 'support') list = [c?.national ?? helpline];
  if (tier === 'urgent') list = c?.national ? [c.national, helpline, emergency] : [helpline, emergency];

  const shown = new Set(crisis.map((r) => r.key));
  return { crisis, tier: list.filter((r) => !shown.has(r.key)) };
}
