import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ALLOWED_EXCEPTIONS, findBannedWords, visibleStrings } from './publicCopy';

const root = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('findBannedWords', () => {
  it('finds each banned word and phrase, in any case', () => {
    for (const bad of [
      'You missed a day',
      'Nothing Logged today',
      'not logged',
      'No data yet',
      'an inactive account',
      'Eat',
      'Built by Group 63',
      'at OUTSKILL',
      'HIPAA compliant',
      'no paywall',
      'for peace of mind',
      'to keep an eye on them',
      'we monitor your days',
      'check on mum',
      'get alerts',
      'keep them safe',
    ]) {
      expect(findBannedWords(bad), bad).not.toEqual([]);
    }
  });

  it('control: whole words only, so close cousins pass', () => {
    for (const ok of ['Day off', 'safety', 'safely', 'great', 'create', 'eating', 'alert', 'remissed', 'The sleep pillar', 'Free for everyone 60 and over.']) {
      expect(findBannedWords(ok), ok).toEqual([]);
    }
  });

  it('allows the one test count, 619, and no other', () => {
    expect(findBannedWords('619 tests pass')).toEqual([]);
    expect(findBannedWords('125 tests pass')).not.toEqual([]);
    expect(findBannedWords('There are 1,024 automated tests')).not.toEqual([]);
  });

  it('skips the listed exceptions and nothing else', () => {
    expect(ALLOWED_EXCEPTIONS.length).toBeGreaterThan(0);
    for (const ex of ALLOWED_EXCEPTIONS) {
      expect(findBannedWords(ex.text), ex.text).toEqual([]);
      expect(findBannedWords(`${ex.text} Keep them safe.`)).toEqual(['safe']);
    }
  });
});

describe('visibleStrings', () => {
  it('keeps sentences and JSX text, and leaves out classes, roles and comments', () => {
    const src = `
      // a comment that says monitor
      /* and another: safe */
      import x from './alerts';
      export default function A() {
        return <p role="alert" className="text-alert rounded">Hello there<span>{'We missed you'}</span></p>;
      }`;
    const got = visibleStrings(src).join(' | ');
    expect(got).toContain('Hello there');
    expect(got).toContain('We missed you');
    expect(got).not.toMatch(/alert|monitor|safe/);
  });
});

describe('the public and product copy', () => {
  const pagesDir = join(root, 'src', 'pages');
  const pageFiles = readdirSync(pagesDir).filter((f) => f.endsWith('.tsx'));

  it('scans a real set of page files', () => {
    expect(pageFiles).toContain('Landing.tsx');
    expect(pageFiles).toContain('Sharing.tsx');
  });

  for (const file of pageFiles) {
    it(`src/pages/${file} uses no banned word`, () => {
      const hits = visibleStrings(readFileSync(join(pagesDir, file), 'utf8')).flatMap(findBannedWords);
      expect(hits).toEqual([]);
    });
  }

  for (const rel of ['src/components/PublicLayout.tsx', 'src/lib/brandCopy.ts', 'src/lib/siteMeta.ts']) {
    it(`${rel} uses no banned word`, () => {
      expect(visibleStrings(read(rel)).flatMap(findBannedWords)).toEqual([]);
    });
  }

  for (const rel of ['index.html', 'public/llms.txt', 'public/manifest.webmanifest']) {
    it(`${rel} uses no banned word`, () => {
      expect(findBannedWords(read(rel))).toEqual([]);
    });
  }

  it('control: the scanner really reads the pages (it finds known sentences)', () => {
    const landing = visibleStrings(readFileSync(join(pagesDir, 'Landing.tsx'), 'utf8')).join(' ');
    expect(landing).toContain('Create your account');
    expect(landing).toContain('Sharing, on your terms');
    const terms = visibleStrings(readFileSync(join(pagesDir, 'Terms.tsx'), 'utf8')).join(' ');
    expect(terms).toContain('keep the app working and your data secure');
  });

  it('control: the scan does catch a banned word placed in a page-shaped string', () => {
    const fake = `export default function P() { return <p>You missed a day</p>; }`;
    expect(visibleStrings(fake).flatMap(findBannedWords)).toEqual(['missed']);
  });
});
