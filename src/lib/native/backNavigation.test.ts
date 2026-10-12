import { describe, expect, it } from 'vitest';
import { decideBack, readHistoryIndex } from './backNavigation';

describe('decideBack', () => {
  it('exits from the dashboard even when there is history behind it', () => {
    expect(decideBack({ historyIndex: 3, pathname: '/dashboard' })).toBe('exit');
  });
  it('exits from the login screen', () => {
    expect(decideBack({ historyIndex: 0, pathname: '/login' })).toBe('exit');
  });
  it('goes back one step on an inner screen', () => {
    expect(decideBack({ historyIndex: 2, pathname: '/settings' })).toBe('go-back');
  });
  it('goes to the dashboard when an inner screen was the first one opened', () => {
    expect(decideBack({ historyIndex: 0, pathname: '/goals' })).toBe('go-home');
  });
  it('goes to the dashboard when the history position is unknown', () => {
    expect(decideBack({ historyIndex: null, pathname: '/goals' })).toBe('go-home');
  });
});

describe('readHistoryIndex', () => {
  it('reads the router index', () => {
    expect(readHistoryIndex({ idx: 2, key: 'abc' })).toBe(2);
  });
  it('returns null for anything else', () => {
    expect(readHistoryIndex(null)).toBeNull();
    expect(readHistoryIndex({})).toBeNull();
    expect(readHistoryIndex({ idx: 'x' })).toBeNull();
  });
});
