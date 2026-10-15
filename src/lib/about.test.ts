import { describe, expect, it } from 'vitest';
import { ABOUT_STORY, FOUNDERS, foundersLine } from './about';

describe('about', () => {
  it('names both founders', () => {
    expect(foundersLine()).toBe('Bob Olmsted and Miah Shull Olmsted');
    expect(FOUNDERS).toHaveLength(2);
  });

  it('joins one, two and three names correctly', () => {
    expect(foundersLine(['A'])).toBe('A');
    expect(foundersLine(['A', 'B'])).toBe('A and B');
    expect(foundersLine(['A', 'B', 'C'])).toBe('A, B and C');
    expect(foundersLine([])).toBe('');
  });

  it('uses the approved founder origin without naming a team or programme', () => {
    expect(ABOUT_STORY).toContain('48-hour hackathon project');
    expect(ABOUT_STORY).toContain('with Claude at 60');
    expect(ABOUT_STORY).not.toMatch(/group 63|outskill|hackathon team/i);
  });
});
