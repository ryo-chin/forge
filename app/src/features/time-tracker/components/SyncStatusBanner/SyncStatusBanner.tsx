import type { SyncState } from '../../hooks/data/useGoogleSpreadsheetSync.ts';

type SyncStatusBannerProps = {
  state: SyncState;
  onRetry?: () => void;
};

const baseStyles: React.CSSProperties = {
  borderRadius: 8,
  padding: '12px 16px',
  margin: '8px 0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const messageStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({ state, onRetry }) => {
  if (state.status === 'idle' || state.status === 'disabled') {
    return null;
  }

  if (state.status === 'success') {
    return (
      <div
        style={{
          ...baseStyles,
          backgroundColor: '#e6f4ea',
          color: '#1a7f37',
        }}
        aria-live="polite"
      >
        <div style={messageStyles}>
          <span>Googleスプレッドシートに同期しました</span>
          {state.lastSessionId && <span>同期済みセッション: {state.lastSessionId}</span>}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        style={{
          ...baseStyles,
          backgroundColor: '#fdecea',
          color: '#8a1f17',
        }}
        role="alert"
      >
        <div style={messageStyles}>
          <span>Googleスプレッドシートへの同期に失敗しました</span>
          {state.error && <span>{state.error}</span>}
        </div>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            再試行
          </button>
        )}
      </div>
    );
  }

  if (state.status === 'syncing') {
    return (
      <div
        style={{
          ...baseStyles,
          backgroundColor: '#eaf3ff',
          color: '#1b4f9c',
        }}
        aria-live="polite"
      >
        <div style={messageStyles}>
          <span>Googleスプレッドシートに同期しています…</span>
        </div>
      </div>
    );
  }

  return null;
};
