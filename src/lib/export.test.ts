import { describe, expect, it } from 'vitest';
import { exportFileName, logsToCsv, toJson } from './export';

const logs = [
  { id: 'b', user_id: 'u', log_date: '2026-09-26', mood: 4, feelings: ['calm', 'grateful'], notes: 'Walked, then "rested", fine' },
  { id: 'a', user_id: 'u', log_date: '2026-09-25', mood: 3, feelings: null, notes: null, steps: 5200 },
];

describe('download my data', () => {
  it('names the files by date', () => {
    expect(exportFileName('2026-09-26', 'json')).toBe('build-your-pillars-data-2026-09-26.json');
    expect(exportFileName('2026-09-26', 'csv')).toBe('build-your-pillars-daily-log-2026-09-26.csv');
  });

  it('writes the daily log as a spreadsheet, oldest first, without internal ids', () => {
    const csv = logsToCsv(logs).split('\n');
    expect(csv[0]).toBe('log_date,mood,feelings,notes,steps');
    expect(csv[1]).toBe('2026-09-25,3,,,5200');
    expect(csv[2]).toBe('2026-09-26,4,calm; grateful,"Walked, then ""rested"", fine",');
    expect(csv[0]).not.toMatch(/user_id|\bid\b/);
  });

  it('includes every part of the account in the JSON (control: an empty account still exports)', () => {
    const json = JSON.parse(
      toJson({ profile: { full_name: 'Demo' }, habit_logs: logs, goals: [], daily_conditions: [], reflections: [] }, 'demo@example.com', '2026-09-26T12:00:00Z'),
    );
    expect(Object.keys(json)).toEqual(
      expect.arrayContaining(['app', 'exported_at', 'account_email', 'about', 'profile', 'habit_logs', 'goals', 'daily_conditions', 'reflections']),
    );
    expect(json.habit_logs).toHaveLength(2);
    expect(logsToCsv([])).toBe('log_date');
  });
});
