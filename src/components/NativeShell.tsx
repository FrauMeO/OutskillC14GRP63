import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  exitApp,
  hideSplash,
  isNative,
  onAppActiveChange,
  onBackButton,
  setDarkStatusBarIcons,
} from '../lib/native/platform';
import { decideBack, readHistoryIndex } from '../lib/native/backNavigation';

/**
 * Renders nothing. Inside the iPhone/Android app it:
 *  - makes the Android back button walk back through screens, and leave the app at the first one;
 *  - starts and stops Supabase's background sign-in refresh as the app comes to the front or goes
 *    to the back (a phone freezes the web view's timers while the app is hidden, so a person who
 *    returns after hours must not be signed out by an expired token);
 *  - hides the launch screen and sets dark status-bar icons.
 * On the website it does nothing at all.
 *
 * Mount once, inside <BrowserRouter> and <AuthProvider> (see docs/mobile-build.md).
 */
export default function NativeShell() {
  const navigate = useNavigate();
  const location = useLocation();
  // Read through a ref so the back-button listener is registered once, not on every screen change.
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const keep = (off: () => void) => (cancelled ? off() : cleanups.push(off));

    void setDarkStatusBarIcons();
    void hideSplash();

    void onBackButton(() => {
      const action = decideBack({
        historyIndex: readHistoryIndex(window.history.state),
        pathname: pathRef.current,
      });
      if (action === 'go-back') navigate(-1);
      else if (action === 'go-home') navigate('/dashboard', { replace: true });
      else void exitApp();
    }).then(keep);

    void onAppActiveChange((isActive) => {
      // startAutoRefresh also checks the token straight away, so a stale one is renewed on return.
      if (isActive) void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    }).then(keep);

    return () => {
      cancelled = true;
      cleanups.forEach((off) => off());
    };
  }, [navigate]);

  return null;
}
