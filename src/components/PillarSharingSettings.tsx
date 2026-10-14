import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CareShareRow } from '../lib/careShares';
import { levelsOf, SCOPE_LABELS, SCOPE_NAMES, SCOPE_PILLARS, type Cadence, type PillarLevels, type ScopedReport } from '../lib/scopedSharing';
import ScopedReportView from './ScopedReportView';
import Notice from './Notice';

export default function PillarSharingSettings({ share, onSaved }: { share: CareShareRow; onSaved: () => Promise<void> }) {
  const [levels, setLevels] = useState(() => levelsOf(share));
  const [cadence, setCadence] = useState<Cadence>(share.report_cadence ?? 'live');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<ScopedReport | null>(null);
  const changed = JSON.stringify(levels) !== JSON.stringify(levelsOf(share)) || cadence !== (share.report_cadence ?? 'live') || !share.pillar_levels;
  async function save() {
    setBusy(true); setMessage(''); setPreview(null);
    try {
      const { error } = await supabase.rpc('set_care_share_matrix', { p_id: share.id, p_levels: levels, p_cadence: cadence });
      if (error) throw error;
      setFailed(false); setMessage('Per-pillar settings saved. Any pause remains unchanged.'); setConfirm(false);
      await onSaved();
    } catch { setFailed(true); setMessage('We could not confirm the save. Refresh the sharing list before relying on these settings.'); }
    finally { setBusy(false); }
  }
  async function showPreview() {
    setBusy(true);setMessage('');setPreview(null);
    try {
      const { data,error } = await supabase.rpc('shared_pillar_report', { p_owner: share.owner_id, p_preview_share: share.id });
      if (error) throw error;
      setPreview(data as unknown as ScopedReport | null);
      setFailed(false);
      if (!data) setMessage('No report is available. Sharing may be paused.');
    } catch {setFailed(true);setMessage('Could not load the saved preview.');}
    finally {setBusy(false);}
  }
  return <details className="mt-4" open={!!share.pillar_levels || undefined}>
    <summary className="min-h-12 cursor-pointer py-3 font-semibold">Choose a different level for each pillar</summary>
    <p className="text-base">Set choices separately for {share.viewer_email}. Nothing grants editing or account management.</p>
    {SCOPE_PILLARS.map(p => <label key={p} className="mt-3 block">{SCOPE_NAMES[p]}
      <select className="mt-1 min-h-12 w-full rounded border border-line bg-white p-2" value={levels[p]} disabled={busy}
        onChange={e => {setLevels({...levels,[p]:e.target.value as PillarLevels[typeof p]});setConfirm(false);setPreview(null);}}>
        {Object.entries(SCOPE_LABELS).map(([v,label]) => <option key={v} value={v}>{label}</option>)}
      </select>
    </label>)}
    <label className="mt-3 block">When and how much history?
      <select className="mt-1 min-h-12 w-full rounded border border-line bg-white p-2" value={cadence} disabled={busy} onChange={e => {setCadence(e.target.value as Cadence);setConfirm(false);setPreview(null);}}>
        <option value="live">Recent 28 days, updated in the app</option><option value="monthly">Last completed month only, no daily values</option>
      </select>
    </label>
    <p className="mt-2 text-base">Monthly reports are viewed in the app, not emailed. “Logged values” becomes monthly averages and counts. Other levels reveal no values. Balance can show that mood or feelings were logged without revealing their content.</p>
    <label className="mt-3 flex min-h-12 items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5" checked={confirm} disabled={busy} onChange={e => setConfirm(e.target.checked)} />I agree to these per-pillar choices and report period for {share.viewer_email}.</label>
    <button type="button" className="mt-3 min-h-12 rounded border border-spruce px-3 disabled:opacity-50" disabled={busy || !confirm || !changed || Object.values(levels).every(v=>v==='off')} onClick={() => void save()}>Save per-pillar choices</button>
    {share.pillar_levels && <button type="button" className="mt-3 min-h-12 px-3 underline" disabled={busy || changed} onClick={() => void showPreview()}>Preview saved choices</button>}
    {message && <Notice kind={failed ? 'error' : 'ok'}>{message}</Notice>}
    {preview && <div className="mt-4"><p className="font-semibold">Private preview of saved settings</p><ScopedReportView report={preview}/></div>}
  </details>;
}
