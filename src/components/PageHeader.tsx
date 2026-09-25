import type { ReactNode } from 'react';

export default function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
      {children && <p className="mt-3 max-w-prose text-lg text-spruce/75">{children}</p>}
    </header>
  );
}
