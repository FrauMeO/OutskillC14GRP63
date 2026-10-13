import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FullPageStatus from './FullPageStatus';
import Landing from '../pages/Landing';

// "/" : the public front door. A signed-in person goes straight to the dashboard.
export default function HomeRoute() {
  const { session, loading } = useAuth();
  if (loading) return <FullPageStatus message="Checking your session…" />;
  if (session) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}
