import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FullPageStatus from './FullPageStatus';

// Login and sign-up pages. Signed-in users go straight to the dashboard.
export default function PublicOnlyRoute() {
  const { session, loading } = useAuth();
  if (loading) return <FullPageStatus message="Checking your session…" />;
  if (session) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
