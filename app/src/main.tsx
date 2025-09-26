import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { TimeTrackerRoot } from '../features/time-tracker/src';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TimeTrackerRoot />
  </React.StrictMode>,
);
