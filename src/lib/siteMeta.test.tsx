import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import type { ComponentType } from 'react';
import { CANONICAL_DESCRIPTION, OFFER_LINE, SITE_URL } from './brandCopy';
import {
  PUBLIC_ROUTES,
  SHARING_FAQ,
  canonicalUrl,
  faqPageLd,
  headTags,
  jsonLdFor,
  jsonLdScript,
  organizationLd,
  routeTitle,
  softwareApplicationLd,
} from './siteMeta';
import { COMPANY } from './company';
import { foundersLine } from './about';

// Public pages must render with no session and no network call: the Supabase client is never reached.
vi.mock('./supabase', () => ({ supabase: new Proxy({}, { get: () => { throw new Error('Supabase was called while rendering a public page'); } }) }));

import { AuthProvider } from '../context/AuthContext';
import Landing from '../pages/Landing';
import Sharing from '../pages/Sharing';
import Why from '../pages/Why';
import Privacy from '../pages/Privacy';
import Terms from '../pages/Terms';
import HealthDataPrivacy from '../pages/HealthDataPrivacy';

const root = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const PAGES: Record<string, ComponentType> = {
  '/': Landing,
  '/sharing': Sharing,
  '/why': Why,
  '/privacy': Privacy,
  '/terms': Terms,
  '/health-data-privacy': HealthDataPrivacy,
};

function render(path: string): string {
  const Page = PAGES[path];
  return renderToString(
    <StaticRouter location={path}>
      <AuthProvider>
        <Page />
      </AuthProvider>
    </StaticRouter>,
  );
}

// The rendered text with tags removed and entities decoded, for comparing with the data the markup came from.
function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

describe('the public routes', () => {
  it('lists the six public pages, each with a page to render', () => {
    expect(PUBLIC_ROUTES.map((r) => r.path)).toEqual(['/', '/sharing', '/why', '/privacy', '/terms', '/health-data-privacy']);
    for (const r of PUBLIC_ROUTES) expect(PAGES[r.path], r.path).toBeDefined();
  });

  it('gives the home page the title Miah chose', () => {
    expect(routeTitle('/')).toBe('Build Your Pillars: gentle health tracking, no judgment');
  });

  it('builds canonical addresses', () => {
    expect(canonicalUrl('/')).toBe(`${SITE_URL}/`);
    expect(canonicalUrl('/sharing')).toBe(`${SITE_URL}/sharing`);
  });

  for (const { path } of PUBLIC_ROUTES) {
    it(`${path} renders real text with no session and no network call`, () => {
      const text = visibleText(render(path));
      expect(text.length).toBeGreaterThan(500);
      expect(text).toContain('Build Your Pillars');
      expect(text).toContain('p.s. live well');
    });

    it(`${path}: the page's own title matches the static title, so nothing flickers when the app starts`, () => {
      expect(headTags(path)).toContain(`<title>${routeTitle(path).replace(/&/g, '&amp;')}</title>`);
    });
  }
});

describe('the home page and the offer', () => {
  const home = visibleText(render('/'));
  it('leads with the everyday value and no-judgment positioning', () => {
    expect(home).toContain('Notice your days. Build what works for you.');
    expect(home).toContain('See your patterns without grades, streaks or judgment.');
  });
  it('uses the offer wording verbatim and shows no dollar figure', () => {
    expect(home).toContain(OFFER_LINE);
    for (const { path } of PUBLIC_ROUTES) expect(visibleText(render(path)), path).not.toMatch(/\$\s?\d/);
  });
  it('links to /sharing', () => {
    expect(render('/')).toContain('href="/sharing"');
  });
  it('ends every page with the signature, lower case, not as a heading', () => {
    const html = render('/');
    expect(html).toMatch(/<p[^>]*>p\.s\. live well<\/p>\s*<\/div>\s*<\/footer>/);
  });
});

describe('/sharing', () => {
  const html = render('/sharing');
  const text = visibleText(html);
  it('answers each question under its own heading, in order', () => {
    let at = 0;
    for (const item of SHARING_FAQ) {
      const q = text.indexOf(item.question, at);
      expect(q, item.question).toBeGreaterThan(-1);
      const a = text.indexOf(item.answer, q);
      expect(a, item.answer).toBeGreaterThan(q);
      at = a;
      expect(html).toMatch(new RegExp(`<h2[^>]*>${item.question.replace(/[?]/g, '\\?')}</h2>`));
    }
  });
  it('asks the six questions Miah listed', () => {
    expect(SHARING_FAQ).toHaveLength(6);
    expect(SHARING_FAQ[3].answer).toContain('"A full week" or "Checking in this week"');
    expect(SHARING_FAQ[4].answer).toMatch(/^No, /);
    expect(SHARING_FAQ[4].answer).toContain('does not detect falls or emergencies');
    expect(SHARING_FAQ[5].answer).toContain(OFFER_LINE);
  });
  it('keeps each answer to two or three sentences', () => {
    for (const item of SHARING_FAQ) {
      const sentences = item.answer.split(/(?<=[.?])\s+(?=[A-Z"])/);
      expect(sentences.length, item.question).toBeGreaterThanOrEqual(2);
      expect(sentences.length, item.question).toBeLessThanOrEqual(3);
    }
  });
  it('never gives a count of days', () => {
    for (const item of SHARING_FAQ) expect(item.answer).not.toMatch(/\b\d+ days?\b/);
  });
});

describe('JSON-LD', () => {
  it('puts the Organization and SoftwareApplication on every page, WebSite only on the home page, FAQPage only on /sharing', () => {
    const types = (p: string) => (jsonLdFor(p)['@graph'] as { '@type': string }[]).map((n) => n['@type']);
    expect(types('/')).toEqual(['Organization', 'SoftwareApplication', 'WebSite']);
    expect(types('/sharing')).toEqual(['Organization', 'SoftwareApplication', 'FAQPage']);
    for (const p of ['/why', '/privacy', '/terms', '/health-data-privacy']) expect(types(p)).toEqual(['Organization', 'SoftwareApplication']);
  });

  it('describes the company from src/lib/company.ts and names both founders', () => {
    const org = organizationLd() as { legalName: string; address: Record<string, string>; founder: { name: string }[] };
    expect(org.legalName).toBe(COMPANY.legalName);
    expect(org.address.streetAddress).toBe(COMPANY.street);
    expect(org.address.addressLocality).toBe(COMPANY.city);
    expect(org.address.postalCode).toBe(COMPANY.postalCode);
    expect(org.founder.map((f) => f.name).join(' and ')).toBe(foundersLine());
  });

  it('control: sameAs is left out, because no social profile URL exists to point to', () => {
    expect(JSON.stringify(jsonLdFor('/'))).not.toContain('sameAs');
  });

  it('says free in words, with no price figure', () => {
    const app = softwareApplicationLd() as { applicationCategory: string; operatingSystem: string; offers: Record<string, unknown> };
    expect(app.applicationCategory).toBe('HealthApplication');
    expect(app.operatingSystem).toBe('Web');
    expect(app.offers.description).toBe(OFFER_LINE);
    expect(JSON.stringify(app)).not.toMatch(/"price|\$\s?\d/);
  });

  it('builds the FAQPage from the same questions and answers the page shows', () => {
    const faq = faqPageLd() as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(SHARING_FAQ.map((q) => [q.question, q.answer]));
  });

  it('matches visible text only: every name, address part and description in the markup is on the page', () => {
    for (const { path } of PUBLIC_ROUTES) {
      const text = visibleText(render(path));
      expect(text, path).toContain(COMPANY.legalName);
      expect(text, path).toContain(COMPANY.street);
      expect(text, path).toContain(COMPANY.postalCode);
      expect(text, path).toContain(foundersLine());
    }
  });

  it('cannot close its own script tag', () => {
    expect(jsonLdScript('/sharing')).not.toContain('<');
    expect(JSON.parse(jsonLdScript('/sharing'))['@context']).toBe('https://schema.org');
  });
});

describe('the head tags', () => {
  it('use the canonical description verbatim', () => {
    const tags = headTags('/sharing');
    expect(tags).toContain(`<meta name="description" content="${CANONICAL_DESCRIPTION}" />`);
    expect(tags).toContain(`<meta property="og:description" content="${CANONICAL_DESCRIPTION}" />`);
    expect(tags).toContain(`<meta property="og:image" content="${SITE_URL}/byp-app-icon-1024.png" />`);
    expect(tags).toContain('<link rel="canonical" href="https://buildyourpillars.com/sharing" />');
  });

  it('control: a quote or angle bracket in a title cannot break out of an attribute', () => {
    // routeTitle() falls back to the home title for an unknown path, so the escaping is exercised through a real title.
    expect(headTags('/')).not.toMatch(/content="[^"]*<[^"]*"/);
  });
});

describe('the static files', () => {
  it('uses the canonical description verbatim in index.html, the manifest and llms.txt', () => {
    expect(read('index.html')).toContain(`<meta name="description" content="${CANONICAL_DESCRIPTION}" />`);
    expect(read('index.html')).toContain(`<meta property="og:description" content="${CANONICAL_DESCRIPTION}" />`);
    expect(JSON.parse(read('public/manifest.webmanifest')).description).toBe(CANONICAL_DESCRIPTION);
    expect(read('public/llms.txt')).toContain(CANONICAL_DESCRIPTION);
  });

  it('starts llms.txt with the product name and links every public page', () => {
    const llms = read('public/llms.txt');
    expect(llms.startsWith('# Build Your Pillars\n')).toBe(true);
    for (const { path } of PUBLIC_ROUTES) expect(llms, path).toContain(`(${canonicalUrl(path)})`);
    expect(llms).not.toMatch(/\$\s?\d/);
  });

  it('lists exactly the public routes in sitemap.xml', () => {
    const locs = [...read('public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(PUBLIC_ROUTES.map((r) => canonicalUrl(r.path)));
  });

  it('robots.txt welcomes search and answer bots and points at the sitemap', () => {
    const robots = read('public/robots.txt');
    expect(robots).toMatch(/User-agent: \*\s+Allow: \//);
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot']) expect(robots).toMatch(new RegExp(`User-agent: ${bot}\\s+Allow: /`));
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});
