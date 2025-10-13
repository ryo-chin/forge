import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { TimeTrackerPage } from './features/time-tracker';
import { AuthProvider } from './infra/auth';
import { AuthStatusBar, AuthLoading, LoginPage } from '@features/logiin';
import { useAuth } from './infra/auth';
import { useTimeTrackerSessions } from './features/time-tracker/hooks/data/useTimeTrackerSessions.ts';

const queryClient = new QueryClient();

function App() {
  const { provider: authProvider, status: authStatus, user, signIn } = useAuth();
  const { mode } = useTimeTrackerSessions({ userId: user?.id ?? null });

  if (mode === 'supabase' && authProvider === 'supabase') {
    if (authStatus === 'loading') {
      return <AuthLoading />;
    }

    if (authStatus === 'unauthenticated') {
      return <LoginPage onSignIn={signIn} />;
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__sidebar-header">
          <span className="app-shell__product">forge</span>
        </div>
        <nav className="app-shell__nav" aria-label="Time Tracker ナビゲーション">
          <button type="button" className="app-shell__nav-item app-shell__nav-item--active">
            Time Tracker
          </button>
          <button type="button" className="app-shell__nav-item" disabled>
            レポート (準備中)
          </button>
        </nav>
        <AuthStatusBar />
      </aside>
      <div className="app-shell__main">
        <TimeTrackerPage />
      </div>
    </div>
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
