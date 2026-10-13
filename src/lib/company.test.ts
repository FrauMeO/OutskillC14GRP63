import { describe, expect, it } from 'vitest';
import { COMPANY, copyrightLine, postalAddress } from './company';

describe('company details', () => {
  it('names the owner and the year in the copyright line', () => {
    expect(copyrightLine()).toBe('© 2026 TranslatingData, LLC. All rights reserved.');
  });

  it('writes the postal address in full, in order', () => {
    expect(postalAddress()).toBe('TranslatingData, LLC, 100 N Howard St, Ste R, Spokane, WA 99201, United States');
  });

  it('control: the legal name is the one the founders supplied, not a founder name', () => {
    expect(COMPANY.legalName).toBe('TranslatingData, LLC');
    expect(COMPANY.legalName).not.toMatch(/Olmsted/);
  });
});
