// The word rules for public and product copy (Miah, 2026-10-13, decisions 5 and 6), as pure
// functions so a test can scan the pages, index.html, llms.txt and the manifest.

// Decision 6: a day without an entry is a "Day off"; none of these words describe it.
// Decision 5: sharing is for staying close, never a safety product.
const BANNED_PHRASES = [
  'missed',
  'not logged',
  'nothing logged',
  'no data',
  'inactive',
  'eat',
  'group 63',
  'outskill',
  'hipaa compliant',
  'no paywall',
  'peace of mind',
  'keep an eye on',
  'monitor',
  'monitors',
  'monitoring',
  'check on',
  'alerts',
  'safe',
] as const;

// The only test count that may appear in copy.
export const ALLOWED_TEST_COUNT = 619;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BANNED_RE = new RegExp(`(?<![\\p{L}\\p{N}_])(${BANNED_PHRASES.map((p) => escapeRe(p).replace(/ /g, '\\s+')).join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
const TEST_COUNT_RE = /(?<![\d,.])(\d[\d,]*)\s+(?:automated\s+|unit\s+)?tests?\b/gi;

/** Exact strings that are allowed to contain a banned word, each with the reason. Remove one only on Miah's say-so. */
export const ALLOWED_EXCEPTIONS: readonly { text: string; why: string }[] = [
  { text: 'Is this for keeping someone safe?', why: 'The /sharing question Miah specified; the answer is no, and it is the FAQPage question.' },
  // The demo video's deliberate "other apps say" line goes here if it is ever added to the code.
];

/** Banned words and phrases found in `text`, lower-cased, in order. Whole words only, any case. */
export function findBannedWords(text: string): string[] {
  let t = text;
  for (const ex of ALLOWED_EXCEPTIONS) t = t.split(ex.text).join(' ');
  const found = [...t.matchAll(BANNED_RE)].map((m) => m[1].toLowerCase().replace(/\s+/g, ' '));
  for (const m of t.matchAll(TEST_COUNT_RE)) {
    if (Number(m[1].replace(/,/g, '')) !== ALLOWED_TEST_COUNT) found.push(`${m[0].toLowerCase()} (only ${ALLOWED_TEST_COUNT} is allowed)`);
  }
  return found;
}

/**
 * The words a person can read in a .tsx file: string literals and JSX text. Comments, import paths and
 * attribute values that are code, not words (className, role, type, id and similar), are left out.
 */
export function visibleStrings(source: string): string[] {
  let s = source;
  s = s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
  s = s.replace(/^\s*import\b[^\n]*$/gm, ' ').replace(/^\s*export\s+\*?[^\n]*\bfrom\b[^\n]*$/gm, ' ');
  // Attributes whose values are code, not copy.
  s = s.replace(/\b(?:className|role|type|id|key|htmlFor|name|autoComplete|inputMode|rel|target|href|to|style|aria-(?:live|labelledby|describedby|current|expanded|hidden)|data-[\w-]+)=(?:"[^"]*"|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/g, ' ');
  const out: string[] = [];
  for (const m of s.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    const str = m[1] ?? m[2] ?? m[3] ?? '';
    // A lone lower-case token is a code word (a key, a CSS class), not a sentence.
    if (/^[a-z0-9_:./#%\[\]-]+$/.test(str)) continue;
    out.push(str);
  }
  for (const m of s.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) out.push(m[1]);
  return out;
}
