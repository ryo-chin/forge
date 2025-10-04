import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { TimeTrackerPage } from '@features/time-tracker';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TimeTrackerPage />
  </React.StrictMode>,
);
