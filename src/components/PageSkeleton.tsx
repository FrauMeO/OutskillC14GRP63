import { useEffect, useState } from 'react';

// Shown while a page's code downloads. It stays invisible for the first 250 ms, so a fast
// connection never sees a flash; on a slow one it is a calm outline of the page, not a spinner.
export default function PageSkeleton({ delayMs = 250 }: { delayMs?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  if (!show) return null;
  return (
    <div role="status" aria-label="Loading the page" className="space-y-4">
      <div className="h-10 w-2/3 max-w-md rounded-md bg-white" />
      <div className="h-24 rounded-lg bg-white" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-lg bg-white" />
        <div className="h-40 rounded-lg bg-white" />
      </div>
    </div>
  );
}
