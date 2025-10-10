import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { TimeTrackerPage } from '@features/time-tracker';
import { AuthProvider } from '@infra/auth';
import { AuthStatusBar } from './components';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
