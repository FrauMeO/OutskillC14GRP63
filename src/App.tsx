import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import AppLayout from './components/AppLayout';
import PageSkeleton from './components/PageSkeleton';
// The sign-in page is the landing page for signed-out visitors, so it ships with the first load.
// Every other page is downloaded only when it is opened (keeps the first visit small on slow data).
import AuthPage from './pages/AuthPage';
import HomeRoute from './components/HomeRoute';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const LogHabits = lazy(() => import('./pages/LogHabits'));
const Goals = lazy(() => import('./pages/Goals'));
const Insights = lazy(() => import('./pages/Insights'));
const Reflect = lazy(() => import('./pages/Reflect'));
const Settings = lazy(() => import('./pages/Settings'));
const Following = lazy(() => import('./pages/Following'));
const FollowingPerson = lazy(() => import('./pages/FollowingPerson'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Why = lazy(() => import('./pages/Why'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const HealthDataPrivacy = lazy(() => import('./pages/HealthDataPrivacy'));
const Plan = lazy(() => import('./pages/Plan'));
const AppointmentSummary = lazy(() => import('./pages/AppointmentSummary'));

// Each page has its own boundary, so the menu stays put while a page loads.
const page = (el: ReactNode) => <Suspense fallback={<PageSkeleton />}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/why" element={page(<Why />)} />
      <Route path="/privacy" element={page(<Privacy />)} />
      <Route path="/terms" element={page(<Terms />)} />
      <Route path="/health-data-privacy" element={page(<HealthDataPrivacy />)} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/forgot-password" element={page(<ForgotPassword />)} />
      </Route>

      {/* Open signed in or not: the emailed link signs the person in, then they choose a password. */}
      <Route path="/reset-password" element={page(<ResetPassword />)} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={page(<Dashboard />)} />
          <Route path="/habits" element={page(<LogHabits />)} />
          <Route path="/goals" element={page(<Goals />)} />
          <Route path="/insights" element={page(<Insights />)} />
          <Route path="/reflect" element={page(<Reflect />)} />
          <Route path="/settings" element={page(<Settings />)} />
          <Route path="/appointment-summary" element={page(<AppointmentSummary />)} />
          <Route path="/plan" element={page(<Plan />)} />
          <Route path="/following" element={page(<Following />)} />
          <Route path="/following/:ownerId" element={page(<FollowingPerson />)} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
