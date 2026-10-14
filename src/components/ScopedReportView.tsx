import { SCOPE_NAMES, type ScopedReport } from '../lib/scopedSharing';
import { formatRange, SUMMARY_MEASURES, formatMeasure } from '../lib/appointmentSummary';
function measureLabel(key: string, value: number) {
  const spec = SUMMARY_MEASURES.find(m => m.key === key);
  return spec ? `${spec.label}: ${formatMeasure(value, spec)}` : null;
}
export default function ScopedReportView({ report }: { report: ScopedReport }) {
  return <section aria-label="Shared pillar report" className="space-y-4">
    <h2 className="text-2xl font-semibold">{report.cadence === 'monthly' ? 'Monthly report' : 'Shared entries'}</h2>
    <p>{formatRange(report.from, report.to)}</p>
    {report.cadence === 'monthly' && <p>Only the last completed calendar month is available. Daily entries and the current month are not shared. This report updates in the app; it is not emailed automatically.</p>}
    {report.pillars.map(p => <section key={p.pillar} className="rounded-lg border border-line p-4">
      <h3 className="text-xl font-semibold">{SCOPE_NAMES[p.pillar]}</h3>
      <p>{p.days_logged} {p.days_logged === 1 ? 'day' : 'days'} logged in this period. Unlogged days are unknown.</p>
      {p.pillar === 'balance' && <p>Mood logged: {p.mood_logged ? 'yes' : 'no'}. Feelings logged: {p.feelings_logged ? 'yes' : 'no'}. Feelings content is never shared.</p>}
      {p.level !== 'detail' && <p>No scores or recorded values are shared for this pillar.</p>}
      {p.entries && <ul className="mt-3 space-y-3">{p.entries.map(e => <li key={e.date}>
        <strong>{e.date}</strong>: logged
        {p.pillar === 'balance' && <span> · Mood: {e.mood_logged ? 'logged' : 'not logged'} · Feelings: {e.feelings_logged ? 'logged' : 'not logged'}</span>}
        {e.values && <ul>{Object.entries(e.values).map(([key,v]) => <li key={key}>{measureLabel(key,v)}</li>)}</ul>}
      </li>)}</ul>}
      {p.measures && <ul>{Object.entries(p.measures).map(([key,m]) => <li key={key}>Average {measureLabel(key,m.average)} ({m.days} logged days)</li>)}</ul>}
    </section>)}
    <p className="text-base text-moss">These are personal entries, not a medical assessment. Notes and locations are excluded.</p>
  </section>;
}
