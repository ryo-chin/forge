import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SyncState } from '../../../hooks/data/useGoogleSpreadsheetSync.ts';
import { SyncStatusBanner } from '../SyncStatusBanner.tsx';

const renderBanner = (state: SyncState, onRetry = vi.fn()) =>
  render(<SyncStatusBanner state={state} onRetry={onRetry} />);

const buildState = (overrides: Partial<SyncState>): SyncState => ({
  status: 'idle',
  lastSessionId: null,
  lastSyncedAt: null,
  error: null,
  ...overrides,
});

describe('SyncStatusBanner', () => {
  it('renders nothing when idle or disabled', () => {
    const { container } = renderBanner(buildState({ status: 'idle' }));
    expect(container).toBeEmptyDOMElement();

    const { container: disabledContainer } = renderBanner(
      buildState({ status: 'disabled' }),
    );
    expect(disabledContainer).toBeEmptyDOMElement();
  });

  it('shows success message when status is success', () => {
    renderBanner(
      buildState({
        status: 'success',
        lastSessionId: 'session-1',
        lastSyncedAt: '2025-10-12T13:00:00.000Z',
      }),
    );

    expect(
      screen.getByText('Googleスプレッドシートに同期しました'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/session-1/),
    ).toBeInTheDocument();
  });

  it('shows error message and retry action when status is error', () => {
    const onRetry = vi.fn();
    renderBanner(
      buildState({
        status: 'error',
        error: 'Failed to append row',
      }),
      onRetry,
    );

    expect(
      screen.getByText('Googleスプレッドシートへの同期に失敗しました'),
    ).toBeInTheDocument();
    expect(screen.getByText('Failed to append row')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
