import type { ReactNode } from 'react';
import { PILLARS, PILLAR_ORDER, PILLAR_PS, PILLAR_TAGLINE } from '../lib/pillars';

// The two-column frame shared by log in, sign up and the password pages.
export default function AuthShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-[1fr_1.1fr]">
      <section className="hidden flex-col justify-end bg-spruce p-12 text-mist md:flex">
        <p className="font-display text-6xl font-bold leading-[0.95] tracking-tight">
          {PILLAR_ORDER.map((key) => (
            <span key={key} className="block">
              {PILLARS[key].name}.
            </span>
          ))}
        </p>
        <p className="mt-6 max-w-sm text-lg text-mist/85">{PILLAR_TAGLINE}</p>
        <p className="mt-2 max-w-sm italic text-mist/70">{PILLAR_PS}</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          {intro}
          {children}
        </div>
      </section>
    </div>
  );
}
