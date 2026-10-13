// Renders every email to files so you can read them in a browser WITHOUT sending anything.
//   npx vite-node scripts/preview-emails.ts [outputFolder]      (default: ./email-preview, git-ignored by you)
// Uses made-up names and tokens. Open the .html files in a browser, and the .txt files in any editor.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderEmail, type TemplateData } from '../src/lib/email/templates';

const out = process.argv[2] ?? 'email-preview';
const token = 'PreviewTokenPreviewTokenPreviewToken0123456';
const samples: Record<string, TemplateData> = {
  'care_invite': { kind: 'care_invite', ownerName: 'Anna Example' },
  'care_nudge_thinking': { kind: 'care_nudge', supporterName: 'Ben Example', preset: 'Thinking of you', muteToken: token },
  'care_nudge_walk': { kind: 'care_nudge', supporterName: 'Ben Example', preset: 'Want to take a walk?', muteToken: token },
  'weekly_digest_presence': { kind: 'weekly_digest', ownerName: 'Anna Example', level: 'presence', daysLogged: 5, unsubscribeToken: token },
  'weekly_digest_summary': {
    kind: 'weekly_digest',
    ownerName: 'Anna Example',
    level: 'summary',
    daysLogged: 6,
    unsubscribeToken: token,
    pillars: [
      { pillar: 'sleep', trend: 'a_little_lower' },
      { pillar: 'move', trend: 'about_usual' },
      { pillar: 'balance', trend: 'a_little_higher' },
    ],
  },
  'waitlist_confirm': { kind: 'waitlist_confirm', confirmToken: token },
};

mkdirSync(out, { recursive: true });
for (const [name, data] of Object.entries(samples)) {
  const r = renderEmail(data, 'https://buildyourpillars.com');
  writeFileSync(join(out, `${name}.html`), r.html);
  writeFileSync(join(out, `${name}.txt`), `Subject: ${r.subject}\n\n${r.text}\n`);
}
console.log(`Wrote ${Object.keys(samples).length * 2} files to ${out}/. Nothing was sent.`);
