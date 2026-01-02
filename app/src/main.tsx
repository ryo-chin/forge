import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthLoading, LoginPage } from '@features/login';
import { SettingsPage } from '@features/settings';
import { TimeTrackerPage } from '@features/time-tracker';
import { useTimeTrackerSessions } from '@features/time-tracker/hooks/data/useTimeTrackerSessions.ts';
import { AuthProvider, useAuth } from '@infra/auth';
import type { AuthContextValue } from '@infra/auth/authContext.ts';
import { AppLayout } from '@ui/layouts/AppLayout';

const queryClient = new QueryClient();

type AuthStatus = AuthContextValue['status'];

type AuthGuardProps = {
  requiresSupabaseAuth: boolean;
  status: AuthStatus;
  children: ReactNode;
};

function RequireAuth({ requiresSupabaseAuth, status, children }: AuthGuardProps): JSX.Element {
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

function RequireGuest({ requiresSupabaseAuth, status, children }: AuthGuardProps): JSX.Element {
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

function AppRoutes(): JSX.Element {
  const { provider, status, user, signIn } = useAuth();
  const { mode } = useTimeTrackerSessions({ userId: user?.id ?? null });

  const requiresSupabaseAuth = mode === 'supabase' && provider === 'supabase';

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RequireGuest requiresSupabaseAuth={requiresSupabaseAuth} status={status}>
            <LoginPage onSignIn={signIn} />
          </RequireGuest>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth requiresSupabaseAuth={requiresSupabaseAuth} status={status}>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/time-tracker" replace />} />
        <Route path="time-tracker" element={<TimeTrackerPage />} />
        <Route path="settings" element={<SettingsPage />} />
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
