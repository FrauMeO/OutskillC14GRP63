import { describe, expect, it } from 'vitest';
import { ABOUT_STORY, FOUNDERS, foundersLine } from './about';

describe('about', () => {
  it('names both founders', () => {
    expect(foundersLine()).toBe('Miah Shull Olmsted and Robert Olmsted');
    expect(FOUNDERS).toHaveLength(2);
  });

  it('joins one, two and three names correctly', () => {
    expect(foundersLine(['A'])).toBe('A');
    expect(foundersLine(['A', 'B'])).toBe('A and B');
    expect(foundersLine(['A', 'B', 'C'])).toBe('A, B and C');
    expect(foundersLine([])).toBe('');
  });

  it('control: the story carries no hackathon or team wording', () => {
    expect(ABOUT_STORY).not.toMatch(/hackathon|group 63|outskill/i);
    expect('Built by Group 63 at a hackathon').toMatch(/hackathon|group 63|outskill/i);
  });
});
