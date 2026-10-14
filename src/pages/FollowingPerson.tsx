import { useEffect, useMemo, useState } from 'react';
import CaregiverPlanCard from '../components/CaregiverPlanCard';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import SharedLevelView from '../components/SharedLevelView';
import { toISODate } from '../lib/dates';
import { flagsOf, pillarSummary, summaryRange, type SharedDay, type SharedGoal } from '../lib/careShares';
import { NOT_AVAILABLE_YET, cleanWeekRows, friendlyError, levelOf, type PillarWeek } from '../lib/careShareLevels';
import { useFollowedPeople } from '../lib/useFollowedPeople';
import Notice from '../components/Notice';
import ScopedReportView from '../components/ScopedReportView';
import type { ScopedReport } from '../lib/scopedSharing';

export default function FollowingPerson() {
  const { ownerId = '' } = useParams();
  const { people, loading, failed, revision, reload } = useFollowedPeople();
  const person = people.find((p) => p.owner_id === ownerId && p.status === 'active') ?? null;
  const level = person ? levelOf(person) : 'detail';
  const paused = person?.paused === true;

  const [scopedReport, setScopedReport] = useState<ScopedReport | null>(null);
  const [days, setDays] = useState<SharedDay[] | null>(null);
  const [weekRows, setWeekRows] = useState<PillarWeek[] | null>(null);
  const [goals, setGoals] = useState<SharedGoal[]>([]);
  const [loadedOwner, setLoadedOwner] = useState('');
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const todayIso = toISODate(new Date());

  useEffect(() => {
    setScopedReport(null);
    setDays(null);
    setWeekRows(null);
    setGoals([]);
    setError(null);
    if (!person || paused || loading) return;
    let cancelled = false;
    const owner = person.owner_id;
    const { from, to } = summaryRange(toISODate(new Date()));
    (async () => {
      try {
        if (person.pillar_levels) {
          const result = await supabase.rpc('shared_pillar_report', { p_owner: owner });
          if (cancelled) return;
          if (result.error || !result.data) return setError('Sharing access changed or this report is unavailable. Please recheck access.');
          setScopedReport(result.data as unknown as ScopedReport);
          setLoadedRevision(revision); setLoadedOwner(owner);
          setDays([]); setWeekRows([]);
          return;
        }
        if (level === 'summary') {
          const w = await supabase.rpc('shared_week_summary', { p_owner: owner });
          if (cancelled) return;
          if (w.error) return setError(friendlyError(w.error));
          setLoadedRevision(revision); setLoadedOwner(owner);
          setWeekRows(cleanWeekRows(w.data ?? []));
          setDays([]);
          return;
        }
        const [d, g] = await Promise.all([
          supabase.rpc('shared_days', { p_owner: owner, p_from: from, p_to: to }),
          // Goals are shared only at the detail level.
          level === 'detail' ? supabase.rpc('shared_goals', { p_owner: owner }) : Promise.resolve({ data: [], error: null }),
        ]);
        if (cancelled) return;
        const failure = d.error ?? g.error;
        if (failure) return setError(friendlyError(failure));
        setLoadedRevision(revision); setLoadedOwner(owner);
        setDays((d.data ?? []) as SharedDay[]);
        setGoals((g.data ?? []) as SharedGoal[]);
        setWeekRows([]);
      } catch {
        if (!cancelled) setError(friendlyError(null));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [person, level, paused, loading, revision]); // eslint-disable-line react-hooks/exhaustive-deps

  const flags = useMemo(() => (person ? flagsOf(person) : { eat: false, sleep: false, move: false, balance: false }), [person]);

  if (loading) return <p role="status" className="text-lg text-moss">Loading…</p>;

  if (!person) {
    return (
      <>
        <PageHeader title="Following" />
        {failed && <button type="button" onClick={() => void reload()} className="min-h-12 px-4 underline">Retry access check</button>}
        {failed && <Notice kind="error" className="mb-3 text-lg">Could not load this page: {failed}</Notice>}
        <p className="max-w-xl text-lg text-moss">{failed ? 'Shared details are hidden until access can be checked again.' : 'You are not following this person. This may have ended, or the invitation is still waiting.'}</p>
        <Link to="/following" className="mt-4 inline-flex min-h-11 items-center text-lg font-semibold underline underline-offset-4">
          Back to Following
        </Link>
      </>
    );
  }

  const name = person.owner_name;
  const ready = loadedOwner === ownerId && loadedRevision === revision && days !== null && weekRows !== null;
  return (
    <>
      <PageHeader title={`Following ${name}`}>
        {paused
          ? 'This is a read-only view.'
          : `Shared with you: ${pillarSummary(flags)}. This is a read-only view. ${name} chooses what you see.`}
      </PageHeader>
      <Link to="/following" className="-mt-4 mb-6 inline-flex min-h-11 items-center text-lg font-semibold underline underline-offset-4">
        Back to Following
      </Link>
      <div className="mb-6">
        <CaregiverPlanCard name={name} />
      </div>

      {paused && (
        <p role="status" className="max-w-xl rounded-lg border border-line bg-white p-6 text-lg">
          {name} has paused sharing for now.
        </p>
      )}

      {!paused && error && (
        <Notice kind="error" className="mb-4 max-w-xl text-lg">
<button type="button" onClick={() => void reload()} className="min-h-12 px-3 underline">Recheck access</button>
          {error === NOT_AVAILABLE_YET ? error : `Could not load ${name}’s days: ${error}`}
        </Notice>
      )}
      {!paused && !error && !ready && <p role="status" className="text-lg text-moss">Loading…</p>}

      {!paused && !error && ready && (
        <>{scopedReport ? <ScopedReportView report={scopedReport} /> : <SharedLevelView level={level} name={name} flags={flags} days={days} weekRows={weekRows} goals={goals} todayIso={todayIso} />}</>
      )}
    </>
  );
}
