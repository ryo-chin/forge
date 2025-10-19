import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { TimeTrackerPage } from '@features/time-tracker';
import { AuthProvider } from '@infra/auth';
import { AuthStatusBar, AuthLoading, LoginPage } from '@features/logiin';
import { useAuth } from '@infra/auth';
import { useTimeTrackerSessions } from './features/time-tracker/hooks/data/useTimeTrackerSessions.ts';
import { AppNav, AppNavOverlay } from './ui/components/AppNav';
import { useResponsiveLayout } from './ui/hooks/useResponsiveLayout';

const queryClient = new QueryClient();

function App() {
  const {
    provider: authProvider,
    status: authStatus,
    user,
    signIn,
  } = useAuth();
  const { mode } = useTimeTrackerSessions({ userId: user?.id ?? null });
  const viewport = useResponsiveLayout();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);

  if (mode === 'supabase' && authProvider === 'supabase') {
    if (authStatus === 'loading') {
      return <AuthLoading />;
    }

    if (authStatus === 'unauthenticated') {
      return <LoginPage onSignIn={signIn} />;
    }
  }

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
        <TimeTrackerPage />
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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
