import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Landing from '../pages/Landing';

// "/" : the public front door. A signed-in person goes straight to the dashboard.
// The page does not wait for the session check: it is already on screen as static HTML (scripts/prerender.mjs),
// and the first render has to match that HTML.
export default function HomeRoute() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}
