import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { CareShareRow } from '../lib/careShares';
import { sharingLine } from '../lib/careShareLevels';

// An always-visible reminder on the Dashboard of who can see the owner's pillars. Only shown when
// there are open shares. Fails closed: on any error it shows nothing and never blocks the page.
export default function SharedWithLine() {
  const { user } = useAuth();
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('care_shares').select('*').eq('owner_id', user.id);
        if (cancelled) return;
        setLine(error ? null : sharingLine((data ?? []) as CareShareRow[]));
      } catch {
        if (!cancelled) setLine(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!line) return null;
  return (
    <p className="-mt-3 mb-5 flex flex-wrap items-center gap-x-3 text-base text-spruce/80">
      <span>{line}</span>
      <Link to="/settings" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
        Change in Settings
      </Link>
    </p>
  );
}
