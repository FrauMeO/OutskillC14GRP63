// "Who has my data": everyone who can receive a person's health information, and what they get.
// One list, so the Settings card and the Consumer Health Data Privacy Policy cannot drift apart
// (a test reads src/pages/HealthDataPrivacy.tsx and checks every name here appears in it).
// Wording from docs/privacy-consent-spec.md, section 5.2.

export type Recipient = { name: string; what: string; why: string; choice: string };

export const RECIPIENTS: Recipient[] = [
  { name: 'Supabase', what: 'Everything you enter.', why: 'To store it for you.', choice: 'Delete your account.' },
  { name: 'Vercel', what: 'Your internet address when you open a page. No entries.', why: 'To host the website.', choice: 'None. It is the website.' },
  { name: 'Anthropic', what: 'Words and numbers for one day or week, and your goals.', why: 'AI help.', choice: 'Switch AI help off.' },
  { name: 'Open-Meteo', what: 'A rounded map position, dates, a city you type, and your internet address.', why: 'Weather.', choice: 'Skip location. Then there is no weather lookup.' },
  { name: 'BigDataCloud', what: 'A rounded map position and your internet address.', why: 'The city name for your location.', choice: 'Say no to location.' },
  { name: 'People you invited', what: 'The pillars you ticked, at the level you chose.', why: 'Following along.', choice: 'End or pause sharing.' },
];
