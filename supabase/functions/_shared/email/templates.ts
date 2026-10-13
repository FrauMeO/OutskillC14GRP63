// Email templates: pure functions from plain data to { subject, html, text }. No network,
// no imports: this file is copied byte-for-byte to supabase/functions/_shared/email/ (a test checks it).
//
// Rules every template follows (CLAUDE.md product principles, docs/caregiver-feature-brief.md):
//  - every interpolated value is escaped (HTML) or stripped of line breaks (subject);
//  - 18px base text, calm colours, no red, no images, no tracking pixels, no click tracking;
//  - the only links are the ones built here from APP_URL plus a fixed path and an opaque token;
//  - one plain "why you got this" line and one way to stop it in EVERY email;
//  - the owner's last name never appears, and no health data appears in any email;
//  - nothing says "missed", nothing is urgent, nothing is read-receipted.

export type DigestPillar = 'eat' | 'sleep' | 'move' | 'balance';
export type DigestTrend = 'about_usual' | 'a_little_lower' | 'a_little_higher' | 'not_enough_days';

export type TemplateData =
  | { kind: 'care_invite'; ownerName?: string | null }
  | { kind: 'care_nudge'; supporterName?: string | null; preset: string; muteToken: string }
  | {
      kind: 'weekly_digest';
      ownerName?: string | null;
      level: 'presence' | 'summary';
      daysLogged: number;
      pillars?: { pillar: DigestPillar; trend: DigestTrend }[];
      unsubscribeToken: string;
    }
  | { kind: 'waitlist_confirm'; confirmToken: string };

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  /** Header value for List-Unsubscribe, or null for emails with nothing to unsubscribe from. */
  unsubscribeUrl: string | null;
}

export const BRAND = 'Build Your Pillars';
export const SUPPORT_ADDRESS = 'hello@buildyourpillars.com';

/** The two nudge messages. Keep in step with NUDGE_PRESETS in rules.ts (a test checks it). */
export const PRESET_TEXT: Record<string, string> = {
  'Thinking of you': 'Thinking of you',
  'Want to take a walk?': 'Want to take a walk?',
};

const PILLAR_NAME: Record<DigestPillar, string> = { eat: 'Drink', sleep: 'Sleep', move: 'Move', balance: 'Balance' };
const TREND_WORDS: Record<Exclude<DigestTrend, 'not_enough_days'>, string> = {
  about_usual: 'about the usual for them',
  a_little_lower: 'a little lower than their usual',
  a_little_higher: 'a little higher than their usual',
};

// ---------- escaping and cleaning ----------
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Remove control characters and line breaks (blocks header injection in subjects). */
export function oneLine(value: string): string {
  let out = '';
  for (const ch of value) {
    const c = ch.codePointAt(0) ?? 0;
    // control characters, DEL, and the Unicode line/paragraph separators all become a space
    out += c < 32 || c === 127 || c === 0x2028 || c === 0x2029 ? ' ' : ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** First name only, at most 30 characters, or the fallback. Surnames never reach a template. */
export function firstName(full: string | null | undefined, fallback: string): string {
  const first = oneLine(full ?? '').split(' ')[0] ?? '';
  const cut = Array.from(first).slice(0, 30).join('');
  return cut || fallback;
}

/** Only https (or http on localhost) origins, no path. Throws otherwise. */
export function checkAppUrl(appUrl: string): string {
  const u = appUrl.replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(u) && !/^http:\/\/localhost(:\d{1,5})?$/i.test(u)) {
    throw new Error('APP_URL must be an https origin such as https://buildyourpillars.com');
  }
  return u;
}

const LINK_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

function actionUrl(appUrl: string, action: 'confirm' | 'mute' | 'unsub', token: string): string {
  if (!LINK_TOKEN.test(token)) throw new Error('Bad link token.');
  return `${checkAppUrl(appUrl)}/email?a=${action}&t=${encodeURIComponent(token)}`;
}

// ---------- shared layout ----------
const COLOR = { text: '#1e3b37', page: '#edf1ee', card: '#ffffff', button: '#1e3b37', buttonText: '#ffffff', soft: '#4a5f5a' };

function layout(heading: string, bodyHtml: string, whyHtml: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${COLOR.page};">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">
<div style="background:${COLOR.card};border-radius:12px;padding:28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.6;color:${COLOR.text};">
<p style="margin:0 0 16px 0;font-size:20px;font-weight:bold;">${escapeHtml(heading)}</p>
${bodyHtml}
<hr style="border:none;border-top:1px solid #d5ddd8;margin:24px 0;">
${whyHtml}
<p style="margin:16px 0 0 0;font-size:18px;color:${COLOR.soft};">${escapeHtml(BRAND)} &middot; ${escapeHtml(SUPPORT_ADDRESS)}</p>
</div></div></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 16px 0;">${html}</p>`;
const button = (href: string, label: string) =>
  `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${COLOR.button};color:${COLOR.buttonText};text-decoration:none;padding:14px 22px;border-radius:8px;font-size:18px;min-height:20px;">${escapeHtml(label)}</a></p>`;
const link = (href: string, label: string) => `<a href="${escapeHtml(href)}" style="color:${COLOR.button};">${escapeHtml(label)}</a>`;

// ---------- the four emails ----------
export function renderEmail(data: TemplateData, appUrl: string): RenderedEmail {
  const base = checkAppUrl(appUrl);

  if (data.kind === 'care_invite') {
    const name = firstName(data.ownerName, 'Someone');
    const open = `${base}/following`;
    const subject = oneLine(
      name === 'Someone' ? 'You have been invited to follow along' : `${name} invited you to follow along`,
    );
    const n = escapeHtml(name);
    const html = layout(
      `${name} would like you to follow along`,
      p(`${n} uses ${escapeHtml(BRAND)}, a gentle app for noticing daily habits. They typed your email address to invite you as someone who can look in on their pillars.`) +
        p('You will only see what they choose to share. You cannot change anything on their side.') +
        p('If you would like to accept, log in or create a free account with this email address, then open Following.') +
        button(open, 'Open Following') +
        p('The invitation ends by itself after 14 days.'),
      p('<strong>Why you got this:</strong> ' + n + ' entered your email address. If you were not expecting this, ignore it: nothing is shared until you accept and log in.') +
        p('To stop it, do nothing. The invitation simply ends. You will not get more emails about it.'),
    );
    const text = [
      `${name} would like you to follow along`,
      '',
      `${name} uses ${BRAND}, a gentle app for noticing daily habits. They typed your email address to invite you as someone who can look in on their pillars.`,
      'You will only see what they choose to share. You cannot change anything on their side.',
      'To accept, log in or create a free account with this email address, then open Following:',
      open,
      'The invitation ends by itself after 14 days.',
      '',
      `Why you got this: ${name} entered your email address. If you were not expecting this, ignore it: nothing is shared until you accept and log in.`,
      'To stop it, do nothing. The invitation simply ends. You will not get more emails about it.',
      '',
      `${BRAND} - ${SUPPORT_ADDRESS}`,
    ].join('\n');
    return { subject, html, text, unsubscribeUrl: null };
  }

  if (data.kind === 'care_nudge') {
    const message = PRESET_TEXT[data.preset];
    if (!message) throw new Error('Unknown nudge message.');
    const name = firstName(data.supporterName, 'Someone who follows your pillars');
    const mute = actionUrl(base, 'mute', data.muteToken);
    const subject = oneLine(data.preset === 'Thinking of you' ? `${name} is thinking of you` : `A note from ${name}`);
    const n = escapeHtml(name);
    const html = layout(
      `A note from ${name}`,
      p(`<span style="font-size:22px;">${escapeHtml(message)}</span>`) +
        p('That is the whole message. There is nothing you need to do or answer.'),
      p(`<strong>Why you got this:</strong> you chose to let ${n} send you a gentle note. They can only send one of two short messages, at most one a day.`) +
        p(`To stop these notes, ${link(mute, 'turn them off')}. It takes one tap and ${n} is not told. You can also change it any time in ${escapeHtml(BRAND)} under Settings.`),
    );
    const text = [
      `A note from ${name}`,
      '',
      message,
      '',
      'That is the whole message. There is nothing you need to do or answer.',
      '',
      `Why you got this: you chose to let ${name} send you a gentle note. They can only send one of two short messages, at most one a day.`,
      `To stop these notes, open this link (one tap, and ${name} is not told): ${mute}`,
      `You can also change it any time in ${BRAND} under Settings.`,
      '',
      `${BRAND} - ${SUPPORT_ADDRESS}`,
    ].join('\n');
    return { subject, html, text, unsubscribeUrl: mute };
  }

  if (data.kind === 'weekly_digest') {
    const name = firstName(data.ownerName, 'Someone you follow');
    const unsub = actionUrl(base, 'unsub', data.unsubscribeToken);
    const days = Math.max(0, Math.min(7, Math.trunc(data.daysLogged)));
    const lines: string[] = [`${name} logged on ${days} of the last 7 days.`];
    if (data.level === 'summary') {
      for (const row of data.pillars ?? []) {
        if (row.trend === 'not_enough_days') continue;
        const words = TREND_WORDS[row.trend];
        if (!words) continue;
        lines.push(`${PILLAR_NAME[row.pillar]}: ${words}.`);
      }
    }
    const subject = oneLine(`Your weekly note about ${name}`);
    const n = escapeHtml(name);
    const html = layout(
      `Your weekly note about ${name}`,
      lines.map((l) => p(escapeHtml(l))).join('') +
        p('Any 4 days in a week make a full week, so every day logged counts. This is only a note, not a report: there is nothing to do.'),
      p(`<strong>Why you got this:</strong> you asked for a weekly summary about ${n}, and they share with you.`) +
        p(`To stop it, ${link(unsub, 'turn off the weekly email')}. You can also turn it off in ${escapeHtml(BRAND)} under Following. If ${n} ends or pauses sharing, these emails simply stop.`),
    );
    const text = [
      `Your weekly note about ${name}`,
      '',
      ...lines,
      'Any 4 days in a week make a full week, so every day logged counts. This is only a note, not a report: there is nothing to do.',
      '',
      `Why you got this: you asked for a weekly summary about ${name}, and they share with you.`,
      `To stop it, open this link: ${unsub}`,
      `You can also turn it off in ${BRAND} under Following. If ${name} ends or pauses sharing, these emails simply stop.`,
      '',
      `${BRAND} - ${SUPPORT_ADDRESS}`,
    ].join('\n');
    return { subject, html, text, unsubscribeUrl: unsub };
  }

  // waitlist_confirm
  const confirm = actionUrl(base, 'confirm', data.confirmToken);
  const subject = 'Please confirm your email address';
  const html = layout(
    'One tap to confirm',
    p(`Someone, hopefully you, asked to hear from ${escapeHtml(BRAND)} when the phone apps are ready.`) +
      p('We will only email you about that, once, and only if you confirm.') +
      button(confirm, 'Yes, email me when it is ready') +
      p('This link works for 48 hours and once only.'),
    p('<strong>Why you got this:</strong> this address was entered on our waiting list form. If that was not you, ignore this email: you will not be added and you will not hear from us again.') +
      p(`To stop it, do nothing. If you are already on the list and want off, write to ${escapeHtml(SUPPORT_ADDRESS)}.`),
  );
  const text = [
    'One tap to confirm',
    '',
    `Someone, hopefully you, asked to hear from ${BRAND} when the phone apps are ready.`,
    'We will only email you about that, once, and only if you confirm.',
    `Confirm: ${confirm}`,
    'This link works for 48 hours and once only.',
    '',
    'Why you got this: this address was entered on our waiting list form. If that was not you, ignore this email: you will not be added and you will not hear from us again.',
    `To stop it, do nothing. If you are already on the list and want off, write to ${SUPPORT_ADDRESS}.`,
    '',
    `${BRAND} - ${SUPPORT_ADDRESS}`,
  ].join('\n');
  return { subject, html, text, unsubscribeUrl: null };
}

/** Words that would break the tone rules. Used by tests, and as a last guard before sending. */
export const FORBIDDEN_WORDING = /\b(missed|overdue|urgent|alert|warning|failed|failure|behind|streak|danger|red flag)\b/i;
