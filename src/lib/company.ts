// The legal owner of Build Your Pillars. Supplied by Miah on 2026-10-12. Counsel has not reviewed the wording
// that uses it (see the LEGAL REVIEW notes in Privacy.tsx and Terms.tsx).
export const COMPANY = {
  legalName: 'TranslatingData, LLC',
  street: '100 N Howard St, Ste R',
  city: 'Spokane',
  region: 'WA',
  postalCode: '99201',
  country: 'United States',
} as const;

export const COPYRIGHT_YEAR = 2026;

export function copyrightLine(): string {
  return `© ${COPYRIGHT_YEAR} ${COMPANY.legalName}. All rights reserved.`;
}

export function postalAddress(): string {
  const c = COMPANY;
  return `${c.legalName}, ${c.street}, ${c.city}, ${c.region} ${c.postalCode}, ${c.country}`;
}
