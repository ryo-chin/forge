import React, { useState, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import './index.css';
import { TimeTrackerPage } from '@features/time-tracker';
import { AuthProvider, useAuth } from '@infra/auth';
import type { AuthContextValue } from '@infra/auth/authContext.ts';
import { AuthStatusBar, AuthLoading, LoginPage } from '@features/logiin';
import { useTimeTrackerSessions } from './features/time-tracker/hooks/data/useTimeTrackerSessions.ts';
import { AppNav, AppNavOverlay } from './ui/components/AppNav';
import { useResponsiveLayout } from './ui/hooks/useResponsiveLayout';

const queryClient = new QueryClient();

type AuthStatus = AuthContextValue['status'];

type AuthGuardProps = {
  requiresSupabaseAuth: boolean;
  status: AuthStatus;
  children: ReactNode;
};

function RequireAuth({
  requiresSupabaseAuth,
  status,
  children,
}: AuthGuardProps): JSX.Element {
  if (!requiresSupabaseAuth) {
    return <>{children}</>;
  }

  if (status === 'loading') {
    return <AuthLoading />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RequireGuest({
  requiresSupabaseAuth,
  status,
  children,
}: AuthGuardProps): JSX.Element {
  if (!requiresSupabaseAuth) {
    return <Navigate to="/time-tracker" replace />;
  }

  if (status === 'loading') {
    return <AuthLoading />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/time-tracker" replace />;
  }

  return <>{children}</>;
}

function AppLayout(): JSX.Element {
  const viewport = useResponsiveLayout();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <div className="app-shell">
        <aside className="app-shell__sidebar">
          <div className="app-shell__sidebar-header">
            <span className="app-shell__product">forge</span>
          </div>
          <AppNav />
          <AuthStatusBar />
        </aside>
        <div className="app-shell__main">
          {viewport === 'mobile' ? (
            <button
              type="button"
              className="app-shell__hamburger time-tracker__touch-target"
              aria-label="メニューを開く"
              aria-expanded={isMobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              ☰
            </button>
          ) : null}
          <Outlet />
        </div>
      </div>
      <AppNavOverlay
        isOpen={isMobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onSelect={() => setMobileNavOpen(false)}
      />
    </>
  );
}

function AppRoutes(): JSX.Element {
  const { provider, status, user, signIn } = useAuth();
  const { mode } = useTimeTrackerSessions({ userId: user?.id ?? null });

  const requiresSupabaseAuth = mode === 'supabase' && provider === 'supabase';

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RequireGuest
            requiresSupabaseAuth={requiresSupabaseAuth}
            status={status}
          >
            <LoginPage onSignIn={signIn} />
          </RequireGuest>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth
            requiresSupabaseAuth={requiresSupabaseAuth}
            status={status}
          >
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/time-tracker" replace />} />
        <Route path="time-tracker" element={<TimeTrackerPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
