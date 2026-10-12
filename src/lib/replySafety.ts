// The reply checker for AI text, in ONE pure module (no imports, no browser or Deno APIs).
//
// SHARED CODE, TWO COPIES. Deno (the Supabase edge function) cannot import from src/, so this file
// is copied byte for byte to supabase/functions/daily-reflection/replySafety.ts. The test
// src/lib/replySafety.test.ts fails the build if the two copies differ. Edit THIS file, then run
//   cp src/lib/replySafety.ts supabase/functions/daily-reflection/replySafety.ts
//
// Used by: the edge function (every reply is checked before it leaves the server) and the browser
// (AiReflectionCard re-checks what it receives: defence in depth).
//
// How it works (docs/ai-safety-plan.md, sections 3b and 4):
//   1. NORMALISE: Unicode NFKC, strip zero-width and other format characters, strip accents and
//      combining marks, map look-alike Cyrillic and Greek letters to Latin, case-fold, join
//      spelled-out letters ("s h o u l d"), undo leetspeak inside mixed letter-and-digit words
//      ("sh0uld"), collapse long runs of one letter ("shooould").
//   2. RULE GROUPS (not one flat list). Each rule has a group and an id; a hit is reported as
//      "group:id". Reasons are codes, never the person's or the model's text.
//   3. STRUCTURE: length, lists, headings, markdown, emoji, foreign scripts.
//   4. FAIL CLOSED: anything unexpected, including a thrown error, is "not ok".
// Words that are harmless on their own ("weight" as a feeling, "ideal" as an adjective, "lose track")
// are NOT blocked; only the harmful uses are (weight loss, your weight, ideal body, ...).

export type ReplyCheck = { ok: boolean; reasons: string[] };
export type ReplyMode = 'day' | 'coach';

// The kind message shown whenever a reply is replaced (shared so the browser and server agree).
export const FALLBACK_MESSAGE =
  'Thank you for logging today. Every entry is a small act of care for yourself, and your future self is grateful for it.';

export type RuleGroup =
  | 'diet'
  | 'body'
  | 'diagnosis'
  | 'medication'
  | 'authority'
  | 'directive'
  | 'judgment'
  | 'link'
  | 'commercial'
  | 'urgency'
  | 'crisis'
  | 'leak'
  | 'coach'
  | 'format';

// ---------- Normalisation ----------

// Look-alike letters from other scripts (lower case; run after toLowerCase).
const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic
  а: 'a', в: 'b', е: 'e', ё: 'e', з: '3', і: 'i', ї: 'i', ј: 'j', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p',
  с: 'c', т: 't', у: 'y', ф: 'f', х: 'x', ү: 'y', һ: 'h', ԁ: 'd', ԛ: 'q', ԝ: 'w', ѕ: 's', ӏ: 'l', ь: 'b', ѵ: 'v', ґ: 'r',
  // Greek
  α: 'a', β: 'b', γ: 'y', δ: 'd', ε: 'e', ζ: 'z', η: 'n', ι: 'i', κ: 'k', λ: 'l', μ: 'u', ν: 'v', ο: 'o',
  π: 'n', ρ: 'p', σ: 'o', ς: 's', τ: 't', υ: 'u', φ: 'f', χ: 'x', ω: 'w',
  // Latin look-alikes that survive NFKC
  ı: 'i', ℓ: 'l', ø: 'o', đ: 'd', ł: 'l', ɡ: 'g', ɑ: 'a', ɩ: 'i', ʏ: 'y', ᴅ: 'd', ᴇ: 'e', ꜱ: 's', ᴛ: 't',
};
const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPHS).join('')}]`, 'gu');

// Format and invisible characters: zero-width space/joiners, bidi marks, soft hyphen, BOM, fillers.
const INVISIBLE_RE = /[\p{Cf}­͏ᅟᅠ឴឵᠎⁠-⁯ㅤ︀-️ﾠ]/gu;

export function normalizeText(raw: string): string {
  let t = String(raw).normalize('NFKC');
  t = t.replace(INVISIBLE_RE, '');
  t = t.replace(/[\p{Cc}]+/gu, ' ');
  t = t.normalize('NFD').replace(/\p{M}+/gu, ''); // accents and combining marks
  t = t.toLowerCase().replace(/ß/g, 'ss');
  t = t.replace(HOMOGLYPH_RE, (c) => HOMOGLYPHS[c] ?? c);
  t = t.replace(/[’‘`´ʼ]/gu, "'").replace(/[–—−‐‑]/gu, '-');
  return t.replace(/\s+/g, ' ').trim();
}

// "s h o u l d", "s.h.o.u.l.d", "s-h-o-u-l-d" -> "should" (four or more single letters in a row).
function joinSpelledOut(t: string): string {
  return t.replace(/(?<![a-z0-9])(?:[a-z][ ._*-]){3,}[a-z](?![a-z0-9])/g, (m) => m.replace(/[ ._*-]/g, ''));
}

// Runs of three or more of the same letter become one ("shooould" -> "should").
const collapseRuns = (t: string) => t.replace(/([a-z])\1{2,}/g, '$1');
// Every run of one letter becomes one (used with the squeezed twin of each word rule).
const squeezeAll = (t: string) => t.replace(/([a-z])\1+/g, '$1');

// Leetspeak, only inside tokens that mix letters with digits or @ $ (so "6200 steps" is untouched).
function unLeet(t: string, one: 'i' | 'l'): string {
  return t.replace(/[a-z0-9@$]+/g, (tok) => {
    if (!/[a-z]/.test(tok) || !/[0-9@$]/.test(tok)) return tok;
    return tok.replace(/[0-9@$]/g, (c) => ({ '0': 'o', '1': one, '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' })[c as string] ?? c);
  });
}

// Between letters, a dot, dash, underscore, asterisk, dot-dot or apostrophe is dropped ("sh-ould").
const dropInnerPunctuation = (t: string) => t.replace(/(?<=[a-z])[-_*.·'](?=[a-z])/g, '');

function textForms(plain: string): string[] {
  const base = joinSpelledOut(plain);
  const forms = new Set<string>();
  for (const b of [base, dropInnerPunctuation(base)]) {
    forms.add(collapseRuns(b));
    forms.add(collapseRuns(unLeet(b, 'i')));
    forms.add(collapseRuns(unLeet(b, 'l')));
  }
  return [...forms];
}

// ---------- Rules ----------

type Rule = { group: RuleGroup; id: string; re: RegExp; twin?: RegExp; coachOnly?: boolean; prep?: (t: string) => string };

// Squeeze the letters of a regex source (not its escapes) so it matches squeezed text.
function squeezeSource(src: string): string {
  return src
    .split(/(\\.)/)
    .map((part) => (part.startsWith('\\') ? part : part.replace(/([a-z])\1+/g, '$1')))
    .join('');
}

const RULES: Rule[] = [];

// A word-list rule: whole words, with a "squeezed twin" that also catches "shoould"-style padding.
function words(group: RuleGroup, id: string, frags: string[], opts: { coachOnly?: boolean; prep?: (t: string) => string } = {}) {
  const src = `\\b(?:${frags.join('|')})\\b`;
  RULES.push({ group, id, re: new RegExp(src), twin: new RegExp(squeezeSource(src)), ...opts });
}
// A context rule written as a full regular expression (no twin).
function pattern(group: RuleGroup, id: string, re: RegExp, opts: { coachOnly?: boolean } = {}) {
  RULES.push({ group, id, re, ...opts });
}

const SELF = '(?:my|your|him|her|them|one)self';

// -- diet, weight and calorie-restriction advice --
words('diet', 'cut-back', ['cut(?:ting|s)?\\s+(?:back|down|out)', 'trim(?:med|ming|s)?']);
words('diet', 'eat-less', [
  '(?:eat|eating|ate)\\s+(?:a\\s+)?(?:less|fewer|smaller|lighter|healthier|clean|more\\s+(?:protein|veg\\w*|salad|fiber|fibre))',
  'skip(?:ping|ped|s)?\\s+(?:a\\s+|your\\s+|the\\s+)?(?:meals?|breakfast|lunch|dinner|dessert|snacks?)',
]);
words('diet', 'fasting', ['fasting', 'intermittent', 'detox\\w*', 'cleanse\\w*', 'keto\\w*', 'paleo', 'low-carb', 'carbs?', 'sugar\\w*', 'portions?', 'restrict\\w*', 'diet\\w*', 'junk\\s+food', 'cheat\\s+(?:meal|day)']);
words('diet', 'burn-off', ['burn(?:ing|ed|s)?\\s+(?:off|fat)', 'fat\\s+(?:loss|burn\\w*)']);
// Calories: any mention is blocked, except the person's own "active calories" / "active kcal" figure.
words('diet', 'calories', ['calor\\w*', 'kcal'], { prep: (t) => t.replace(/\bactive\s+(?:calories|kcal)\b/g, ' ') });

// -- body and weight talk (only the harmful uses; "weight" alone is fine) --
pattern(
  'body',
  'weight-talk',
  /\b(?:your|my|his|her|their|our|body|ideal|healthy|target|goal|extra|excess|more|less|lose|loose|losing|lost|loss|gain|gaining|gained|shed|shedding|watch|watching|manage|managing|control)\s+weight\b/,
);
pattern('body', 'weight-change', /\bweight[- ](?:loss|gain|management|goals?|control|watch\w*|issues?|problems?)\b/);
pattern('body', 'lose-weight', /\b(?:lose|loose|losing|lost|shed|shedding|gain|gaining|gained|put\s+on)\s+(?:some\s+|a\s+few\s+|any\s+|the\s+|that\s+|those\s+)?(?:weight|pounds|kilos|fat|inches)\b/);
words('body', 'body-words', [
  'bmi', 'obes\\w*', 'overweight', 'underweight', 'skinny', 'slim\\w*', 'slender', 'thinner', 'chubby', 'plump',
  'body\\s+(?:fat|image|shape|size|type|mass)', 'waist\\w*', 'belly', 'physique', 'toned', 'six[- ]pack',
  'pounds', 'lbs?', 'kilos?', 'kilograms?', 'kgs?', 'appearance',
]);
pattern('body', 'ideal-body', /\bideal\s+(?:body|shape|size|figure|bmi|look|weight)\b/);

// -- diagnosis and named conditions --
words('diagnosis', 'named-condition', [
  'diagnos\\w*', 'disorders?', 'depress\\w*', 'anxiety', 'clinical\\w*', 'dementia', 'alzheimer\\w*', 'adhd',
  'bipolar', 'ocd', 'ptsd', 'panic\\s+(?:attacks?|disorder)', 'insomnia', 'schizo\\w*', 'psychos\\w+', 'manic', 'mania',
  'autis\\w+', 'anorexi\\w*', 'bulimi\\w*', 'binge\\w*', 'apnea', 'diabet\\w*', 'hypertension', 'blood\\s+pressure',
  'cancer', 'mental\\s+(?:illness|disorder|health\\s+(?:conditions?|issues?|problems?|concerns?))', 'medical\\s+conditions?',
  'health\\s+conditions?', 'cognitive\\s+(?:decline|impairment)', 'memory\\s+(?:loss|problems?)', 'syndromes?', 'symptoms?',
  'diseases?', 'illness(?:es)?', 'burnout', 'trauma\\w*',
]);
pattern('diagnosis', 'inference', /\b(?:signs?\s+of|may\s+indicate|indicat(?:e|es|ed|ing|ion)|points?\s+to|pointing\s+to|suggests?\s+(?:that\s+)?you\s+(?:may|might|could|have)|you\s+(?:may|might)\s+have)\b/);

// -- medication, supplements, treatment and therapy --
words('medication', 'drugs-and-supplements', [
  'medic\\w*', 'meds?', 'tablets?', 'pills?', 'capsules?', 'prescri\\w*', 'supplement\\w*', 'vitamins?', 'melatonin',
  'magnesium', 'ashwagandha', 'cbd', 'cannabis', 'marijuana', 'antidepress\\w*', 'ssris?', 'benzo\\w*', 'opioids?',
  'sedatives?', 'ibuprofen', 'paracetamol', 'acetaminophen', 'tylenol', 'aspirin', 'painkillers?', 'steroids?', 'insulin',
  'herbal', 'over-the-counter', 'sleeping\\s+aids?', 'treatments?', 'therap\\w*', 'counsel\\w*',
]);
pattern('medication', 'dose-unit', /\b\d+(?:\.\d+)?\s?(?:mg|mcg|iu)\b/);
pattern('medication', 'dose', /\b(?:dosage|dosing|dose\s+of\s+(?:medic\w*|drugs?|\d)|(?:adjust|increas|decreas|doubl|skip|miss|chang|rais|lower)\w*\s+(?:your\s+|the\s+)?dos(?:e|es|age))\b/);

// -- authority and identity claims --
words('authority', 'professional', [
  'doctors?', 'dr', 'physicians?', 'nurses?', 'clinicians?', 'gp', 'psychiatr\\w*', 'psycholog\\w*', 'dietitians?',
  'dieticians?', 'nutritionists?', 'specialists?', 'professional\\s+help', 'health\\s*care\\s+providers?', 'health\\s+professionals?',
  'medical\\s+(?:advice|opinion|professional|attention|treatment|guidance|care)',
]);
pattern('authority', 'as-your', /\bas\s+(?:your|a|an)\s+(?:\w+\s+)?(?:doctor|nurse|physician|clinician|therapist|counsel\w*|psychologist|psychiatrist|dietitian|nutritionist|trainer|expert|professional)\b/);
pattern('authority', 'i-am', /\bi\s*(?:am|'m)\s+(?:a\s+|an\s+|your\s+)?(?:real|human|person|doctor|nurse|physician|therapist|counsel\w*|clinician|psychologist|psychiatrist|dietitian|nutritionist|trainer|friend|living|actual)\b/);
pattern('authority', 'contact-me', /\b(?:my\s+name\s+is|call\s+me|text\s+me|message\s+me|reach\s+me|contact\s+me|email\s+me|dm\s+me|write\s+to\s+me)\b/);

// -- directives (the app never says what a person should do) --
words('directive', 'should-must', [
  'should\\w*', 'must(?:n)?', 'ought\\w*', '(?<!no )need(?:s|ed)?\\s+to', '(?:have|has|had)\\s+to', 'got\\s+to', 'gotta',
  'supposed\\s+to', 'required\\s+to', 'make\\s+sure', 'be\\s+sure\\s+to', 'important\\s+(?:to|that)', 'essential', 'necessary',
  'vital(?:ly)?', 'crucial\\w*', 'recommend\\w*', 'advis\\w*', 'try\\s+harder', 'push\\s+yourself', 'force\\s+yourself',
  'discipline', "you(?:'ll|\\s+will)\\s+want\\s+to", "it(?:'s|\\s+is)\\s+time\\s+to",
  'better\\s+(?:to\\s+)?(?:rest|sleep|eat|drink|walk|get|go|stop)',
]);

// -- judging, grading, comparing --
words('judgment', 'grading', [
  'lazy', 'fail\\w*', 'bad\\s+(?:day|night|week|sleep|mood|habits?)', 'good\\s+(?:day|week)', 'poor(?:ly)?', 'disappoint\\w*',
  'terrible', 'awful', 'horrible', 'worst', 'unhealthy', 'inadequate', 'insufficient', 'weak', 'pathetic', 'ashamed',
  'shame', 'guilt\\w*', 'blame\\w*', 'excuses?', 'slack\\w*', 'on\\s+track', 'off\\s+track', 'normal\\s+range',
  'within\\s+normal', 'recommended\\s+(?:amount|range|daily)', 'healthy\\s+range',
]);
words('judgment', 'comparison', [
  'above\\s+average', 'below\\s+average', 'the\\s+average', 'average\\s+(?:person|adult|people|man|woman)', 'national\\s+average', 'norms?', 'typical\\s+(?:person|people|adults?|range)', 'most\\s+people', 'other\\s+people', 'peers',
  'compared\\s+(?:to|with)', 'than\\s+(?:most|others|average|normal|typical|anyone|everyone)', 'your\\s+age', 'for\\s+your\\s+age',
  'people\\s+your', 'rank\\w*', 'scor(?:e|ed|es|ing)', 'grades?', 'graded',
]);
pattern('judgment', 'ideal-target', /\b(?:ideal|perfect|optimal|healthy|target|recommended)\s+(?:\d[\d,.]*\s+)?(?:steps|hours|amount|number|range|level|sleep|water|intake|goal|bmi)\b/);
pattern('judgment', 'aim-for-ideal', /\baim\s+for\s+(?:the\s+)?(?:ideal|recommended|standard|perfect)\b/);

// -- links, phone numbers, email addresses, handles --
pattern('link', 'url', /\b(?:https?|ftp):|\bwww\.|\btel:/);
pattern('link', 'domain', /\b[a-z0-9-]{2,}\.(?:com|org|net|edu|gov|io|info|biz|xyz|test|shop|store|online|site|link|dev)\b/);
pattern('link', 'domain-spelled', /\s*[[(]\s*dot\s*[\])]\s*|\bdot\s+(?:com|org|net|edu|gov|io)\b/);
pattern('link', 'email', /[\w.+-]+\s?(?:@|\[at\]|\(at\))\s?[\w-]+/);
pattern('link', 'handle', /(?:^|\s)@[a-z0-9_]{2,}/);
pattern('link', 'phone', /(?<![\d.])(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}(?![\d])|\b\d{9,}\b|\b(?:call|dial|text)\s+\+?\d/);

// -- commercial language and pressure (EU AI Act Art. 5(1)(a) and (b): older and vulnerable users) --
words('commercial', 'sales', [
  'buy\\w*', 'bought', 'purchas\\w*', 'subscri\\w*', 'upgrad\\w*', 'premium', 'pro\\s+(?:plan|version|tier)', 'discount\\w*',
  'coupons?', 'promo\\w*', 'special\\s+offer', 'limited[- ]time', 'limited\\s+offer', 'act\\s+now', 'order\\s+now',
  'sign\\s+up', 'join\\s+(?:now|today|us)', 'free\\s+(?:trial|gift|shipping)', 'sale', 'pric(?:e|es|ing)', 'payments?',
  'pay\\s+(?:now|today)', 'paid\\s+(?:plan|version)', 'unlock\\w*', 'membership', 'billing', 'checkout', 'renewal',
  'sponsor\\w*', 'affiliate', 'advert\\w*', 'usd', 'eur', 'gbp', 'dollars?', 'euros?',
]);
pattern('commercial', 'money', /[$€£]\s?\d|\b\d+\s?%\s+off\b/);
words('urgency', 'pressure', [
  'come\\s+back\\s+(?:tomorrow|soon|later|every|daily|each|again|to\\s+us)', 'see\\s+you\\s+(?:tomorrow|soon|again)',
  'miss\\s+you', '(?:lose|losing|lost|break|breaking|broke|protect|keep|save|maintain)\\s+(?:your|the)\\s+(?:streak|progress)',
  "don'?t\\s+(?:forget|stop|quit|break|lose|miss)", 'urgent\\w*', 'immediately', 'asap', 'right\\s+away',
  "before\\s+it(?:'s|\\s+is)\\s+too\\s+late", 'running\\s+out', 'time\\s+is\\s+running', 'deadline', 'hurry', 'last\\s+chance',
  "don'?t\\s+miss", 'today\\s+only', 'expires?', 'expiring',
]);

// -- self-harm and suicide content (a model reply must never engage with it) --
words('crisis', 'self-harm', [
  'suicid\\w*', `kill\\w*\\s+${SELF}`, 'self[- ]?harm\\w*', `hurt\\w*\\s+${SELF}`, `harm\\w*\\s+${SELF}`,
  'end\\s+(?:it\\s+all|my\\s+life|your\\s+life|their\\s+life)', 'take\\s+(?:my|your)\\s+(?:own\\s+)?life', 'overdos\\w*',
  'want\\s+to\\s+die', 'better\\s+off\\s+dead', 'no\\s+(?:point|reason)\\s+(?:in\\s+)?(?:living|going\\s+on|continuing)',
  `cut(?:ting)?\\s+${SELF}`, 'noose', 'die', 'dies', 'died', 'dying', 'dead', 'death',
]);

// -- prompt and instruction leaks, jailbreak talk --
words('leak', 'instructions', [
  'system\\s+prompt', 'my\\s+(?:instructions|rules|guidelines|prompt|programming)', 'instructions\\s+(?:say|tell)',
  'i\\s+(?:was|am)\\s+(?:told|instructed|programmed)', 'ignore\\s+(?:all|any|previous|prior|the\\s+above)', 'as\\s+an\\s+ai',
  'language\\s+model', 'jailbreak', 'developer\\s+mode', 'anthropic', 'openai',
]);

// -- weekly coach: a goal not reached is information, never failure --
words('coach', 'framing', [
  'missed', 'miss\\s+your', 'fell\\s+short', 'falling\\s+short', 'behind', 'only\\s+managed', 'disappoint\\w*', 'not\\s+enough',
  'lagg(?:ing|ed)', 'lags?', 'catch(?:ing)?\\s+up', 'under-?achiev\\w*', 'shortfall', 'below\\s+(?:your\\s+)?(?:goal|target)',
  'short\\s+of\\s+(?:your\\s+)?(?:goal|target)', 'falling\\s+off',
], { coachOnly: true });

// ---------- Structure ----------

const EMOJI_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
const LIST_RE = /(?:^|\n)[ \t]*(?:[-*•–—]|\d{1,2}[.)])[ \t]+\S/;
const HEADING_RE = /(?:^|\n)[ \t]*#{1,6}[ \t]+\S/;
const MARKDOWN_RE = /\*\*|__|`|\[[^\]]*\]\([^)]*\)/;
const FOREIGN_SCRIPT_RE = /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function structureReasons(raw: string, maxLength: number): string[] {
  const out: string[] = [];
  const trimmed = raw.replace(/^["'\s]+|["'\s]+$/g, '');
  if (!trimmed) out.push('format:empty');
  if (trimmed.length > maxLength) out.push('format:too-long');
  if (EMOJI_RE.test(raw)) out.push('format:emoji');
  if (LIST_RE.test(raw)) out.push('format:list');
  if (HEADING_RE.test(raw)) out.push('format:heading');
  if (MARKDOWN_RE.test(raw)) out.push('format:markdown');
  if (FOREIGN_SCRIPT_RE.test(raw)) out.push('format:foreign-script');
  return out;
}

// ---------- The check ----------

const DEFAULT_MAX = { day: 700, coach: 900 } as const;

// Fails closed: a thrown error, a non-string or an empty reply is "not ok".
export function checkReply(raw: unknown, opts: { mode?: ReplyMode; maxLength?: number } = {}): ReplyCheck {
  try {
    if (typeof raw !== 'string') return { ok: false, reasons: ['format:not-text'] };
    const mode: ReplyMode = opts.mode === 'coach' ? 'coach' : 'day';
    const maxLength = opts.maxLength ?? DEFAULT_MAX[mode];
    const reasons = new Set<string>(structureReasons(raw, maxLength));

    const plain = normalizeText(raw);
    const forms = textForms(plain);
    // Links, numbers and addresses are matched on the text before any leetspeak undoing.
    const linkForms = [plain, forms[0]];

    for (const rule of RULES) {
      if (rule.coachOnly && mode !== 'coach') continue;
      const targets = rule.group === 'link' || rule.group === 'commercial' ? [...linkForms, ...forms] : forms;
      let hit = false;
      for (const t of targets) {
        const text = rule.prep ? rule.prep(t) : t;
        if (rule.re.test(text) || (rule.twin && rule.twin.test(squeezeAll(text)))) {
          hit = true;
          break;
        }
      }
      if (hit) reasons.add(`${rule.group}:${rule.id}`);
    }
    return { ok: reasons.size === 0, reasons: [...reasons] };
  } catch {
    return { ok: false, reasons: ['error'] };
  }
}

// Tidy a reply for display: trims quotes and collapses whitespace (call only after checkReply is ok).
export function tidyReply(raw: string): string {
  return raw.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim();
}

// For tests and the CI gate: the rule ids that exist, by group.
export function ruleIds(): string[] {
  return RULES.map((r) => `${r.group}:${r.id}`);
}
