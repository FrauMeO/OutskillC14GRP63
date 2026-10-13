import { NavLink, Outlet } from 'react-router-dom';
import { confirmLeave } from '../lib/unsaved';
import { useAuth } from '../context/AuthContext';
import { useFollowedPeople } from '../lib/useFollowedPeople';
import PendingConsentRecorder from './PendingConsentRecorder';

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/habits', label: 'Log habits' },
  { to: '/goals', label: 'Goals' },
  { to: '/insights', label: 'Insights' },
  { to: '/settings', label: 'Settings' },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  // The Following item appears only when there is someone to follow or an invitation waiting.
  // If the lookup fails, the item stays hidden.
  const { people } = useFollowedPeople();
  const nav = people.length > 0 ? [...NAV.slice(0, -1), { to: '/following', label: 'Following' }, NAV[NAV.length - 1]] : NAV;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <PendingConsentRecorder />
      <aside className="flex flex-col bg-spruce text-mist md:sticky md:top-0 md:h-screen">
        <div className="px-6 pt-6 pb-4 md:pb-10">
          <p className="font-display text-2xl font-bold leading-tight tracking-tight">
            Build Your
            <br className="hidden md:block" /> Pillars
          </p>
        </div>

        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={(e) => {
                if (!confirmLeave()) e.preventDefault();
              }}
              className={({ isActive }) =>
                [
                  'flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-base transition-colors',
                  isActive
                    ? 'bg-mist font-semibold text-spruce'
                    : 'text-mist/80 hover:bg-spruce-soft hover:text-mist',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto hidden border-t border-spruce-soft px-6 py-5 md:block">
          <p className="truncate text-sm text-mist/70" title={user?.email ?? ''}>
            {user?.email}
          </p>
          <button
            type="button"
            onClick={() => confirmLeave() && signOut()}
            className="mt-2 text-sm font-semibold text-mist underline-offset-4 hover:underline"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="px-5 py-8 md:px-12 md:py-12">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
        <button
          type="button"
          onClick={signOut}
          className="mt-12 text-sm font-semibold text-spruce underline underline-offset-4 md:hidden"
        >
          Log out
        </button>
      </main>
    </div>
  );
}
