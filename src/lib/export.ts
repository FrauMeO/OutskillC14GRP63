// "Download my data" (Miah, 2026-09-26): everything a person has logged, in one file they keep.
// People say privacy is a top worry with health apps, so the app shows plainly what it holds.
// Pure: the Settings page fetches the rows (RLS limits them to the person) and passes them in.

type Row = Record<string, unknown>;

export type ExportData = {
  profile: Row | null;
  habit_logs: Row[];
  goals: Row[];
  daily_conditions: Row[];
  reflections: Row[];
};

export function exportFileName(todayIso: string, ext: 'json' | 'csv'): string {
  return `build-your-pillars-${ext === 'csv' ? 'daily-log' : 'data'}-${todayIso}.${ext}`;
}

// The whole account, with a short note on what each part is.
export function toJson(data: ExportData, email: string | null, exportedAt: string): string {
  return JSON.stringify(
    {
      app: 'Build Your Pillars',
      exported_at: exportedAt,
      account_email: email,
      about: {
        profile: 'Your name, home city and settings.',
        habit_logs: 'One row per day you logged: habits, mood, energy, stress, feelings, notes and where the weather came from.',
        goals: 'The goals you set.',
        daily_conditions: 'The weather, air and moon for each logged day, from Open-Meteo.com (CC BY 4.0).',
        reflections: 'Dates the gentle check-in was offered, and any answers you chose to give.',
      },
      ...data,
    },
    null,
    2,
  );
}

// One CSV cell: quote when needed, arrays joined with "; ".
function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// The daily log as a spreadsheet, oldest day first. Internal ids are left out.
export function logsToCsv(logs: Row[]): string {
  const skip = new Set(['id', 'user_id']);
  const columns: string[] = [];
  for (const r of logs) for (const k of Object.keys(r)) if (!skip.has(k) && !columns.includes(k)) columns.push(k);
  const dateFirst = ['log_date', ...columns.filter((c) => c !== 'log_date')];
  const sorted = [...logs].sort((a, b) => String(a.log_date).localeCompare(String(b.log_date)));
  return [dateFirst.join(','), ...sorted.map((r) => dateFirst.map((c) => cell(r[c])).join(','))].join('\n');
}
