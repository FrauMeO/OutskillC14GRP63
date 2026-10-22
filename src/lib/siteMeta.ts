// What the public pages say about themselves: titles, the sharing questions and answers, and the
// JSON-LD that describes them. The prerender step (scripts/prerender.mjs) and the pages read from
// here, so the markup always matches the visible text.
import { COMPANY } from './company';
import { FOUNDERS } from './about';
import { CANONICAL_DESCRIPTION, HOME_TITLE, OFFER_LINE, SITE_URL } from './brandCopy';

export type PublicRoute = { path: string; title: string };

// The public routes that are rendered to static HTML at build time. Order is the sitemap order.
export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { path: '/', title: HOME_TITLE },
  { path: '/sharing', title: 'How sharing works | Build Your Pillars' },
  { path: '/why', title: 'Why we built it | Build Your Pillars' },
  { path: '/privacy', title: 'Privacy Policy | Build Your Pillars' },
  { path: '/terms', title: 'Terms of Use | Build Your Pillars' },
  { path: '/health-data-privacy', title: 'Consumer Health Data Privacy Policy | Build Your Pillars' },
];

export function routeTitle(path: string): string {
  return PUBLIC_ROUTES.find((r) => r.path === path)?.title ?? HOME_TITLE;
}

export function canonicalUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

// ---------- /sharing: each heading with its answer. This is also the FAQPage markup source. ----------

export type FaqItem = { question: string; answer: string };

export const SHARING_FAQ: readonly FaqItem[] = [
  {
    question: 'Who can see my entries?',
    answer:
      'Only you, until you invite someone. You pick the person, and they have to say yes. They get a read-only view of what you chose to share, and nothing else.',
  },
  {
    question: 'Can I choose which pillars they see?',
    answer:
      'Yes. You tick the pillars you want to share: Drink, Sleep, Move, Balance, or any mix. You also choose how much they see, from just that you logged a day, to a weekly summary in words, to day-by-day detail.',
  },
  {
    question: 'Can I pause or stop sharing?',
    answer:
      'Yes, any time. When you pause, they see nothing until you start again. When you stop, their access ends straight away, and you can invite them again later if you like.',
  },
  {
    question: 'What does the person I invite see on a day I did not check in?',
    answer:
      'A day without an entry is a Day off, and nothing is marked. They never see a count of days. In the weekly view they see either "A full week" or "Checking in this week".',
  },
  {
    question: 'Is this for keeping someone safe?',
    answer:
      'No, it is for staying close. It does not detect falls or emergencies, and it cannot call anyone for help. If there is an emergency, call your local emergency number.',
  },
  {
    question: 'Does it cost anything?',
    answer: `${OFFER_LINE} We ask only for the month and year you were born, never the day, to know which one applies.`,
  },
];

// ---------- JSON-LD ----------

type Json = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;

// Founders' full names are listed only where the page shows them (/why); the footer says "Miah and Bob Olmsted".
export function organizationLd(withFounders = false): Json {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Build Your Pillars',
    legalName: COMPANY.legalName,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/icon-512.png`,
    description: CANONICAL_DESCRIPTION,
    address: {
      '@type': 'PostalAddress',
      streetAddress: COMPANY.street,
      addressLocality: COMPANY.city,
      addressRegion: COMPANY.region,
      postalCode: COMPANY.postalCode,
      addressCountry: COMPANY.country,
    },
    ...(withFounders ? { founder: FOUNDERS.map((name) => ({ '@type': 'Person', name })) } : {}),
    // sameAs is left out on purpose: no social profile URL exists in this repo, and none is invented.
  };
}

export function softwareApplicationLd(): Json {
  return {
    '@type': 'SoftwareApplication',
    name: 'Build Your Pillars',
    url: `${SITE_URL}/`,
    description: CANONICAL_DESCRIPTION,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    // Free, in words. No price figure.
    offers: { '@type': 'Offer', category: 'Free', description: OFFER_LINE },
    publisher: { '@id': ORG_ID },
  };
}

export function webSiteLd(): Json {
  return {
    '@type': 'WebSite',
    name: 'Build Your Pillars',
    url: `${SITE_URL}/`,
    description: CANONICAL_DESCRIPTION,
    publisher: { '@id': ORG_ID },
  };
}

export function faqPageLd(items: readonly FaqItem[] = SHARING_FAQ): Json {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  };
}

/** The JSON-LD graph for one public page. Organization and SoftwareApplication on every page, WebSite on the home page, FAQPage on /sharing. */
export function jsonLdFor(path: string): Json {
  const graph: Json[] = [organizationLd(path === '/why'), softwareApplicationLd()];
  if (path === '/') graph.push(webSiteLd());
  if (path === '/sharing') graph.push(faqPageLd());
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** JSON-LD as text for a <script> tag: "<" is escaped so the text can never close the tag. */
export function jsonLdScript(path: string): string {
  return JSON.stringify(jsonLdFor(path)).replace(/</g, '\\u003c');
}

// ---------- Head tags for a prerendered page ----------

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The <title>, description, canonical, Open Graph and JSON-LD tags for one public page, as HTML text. */
export function headTags(path: string): string {
  const title = escAttr(routeTitle(path));
  const url = escAttr(canonicalUrl(path));
  const desc = escAttr(CANONICAL_DESCRIPTION);
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${desc}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE_URL}/byp-app-icon-1024.png" />`,
    `<script type="application/ld+json">${jsonLdScript(path)}</script>`,
  ].join('\n    ');
}
