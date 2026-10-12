import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import AppLayout from './components/AppLayout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import LogHabits from './pages/LogHabits';
import Goals from './pages/Goals';
import Insights from './pages/Insights';
import Reflect from './pages/Reflect';
import Settings from './pages/Settings';
import Following from './pages/Following';
import FollowingPerson from './pages/FollowingPerson';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import HomeRoute from './components/HomeRoute';
import Why from './pages/Why';
import Privacy from './pages/Privacy';
import Plan from './pages/Plan';
import AppointmentSummary from './pages/AppointmentSummary';
import Terms from './pages/Terms';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/why" element={<Why />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Open signed in or not: the emailed link signs the person in, then they choose a password. */}
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/habits" element={<LogHabits />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/reflect" element={<Reflect />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/appointment-summary" element={<AppointmentSummary />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/following" element={<Following />} />
          <Route path="/following/:ownerId" element={<FollowingPerson />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
