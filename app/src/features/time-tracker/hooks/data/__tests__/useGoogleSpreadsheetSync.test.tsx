import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeTrackerSession } from '../../../domain/types.ts';
import { useGoogleSpreadsheetSync } from '../useGoogleSpreadsheetSync.ts';

const mocks = vi.hoisted(() => {
  const syncSessionMock = vi.fn();
  const clearRunningSessionMock = vi.fn();
  const isEnabledMock = vi.fn(() => true);
  const getBaseUrlMock = vi.fn(() => 'https://worker.example.com');
  const getSessionMock = vi.fn();
  return {
    syncSessionMock,
    clearRunningSessionMock,
    isEnabledMock,
    getBaseUrlMock,
    getSessionMock,
  };
});

vi.mock('@infra/google', () => ({
  syncSession: mocks.syncSessionMock,
  clearRunningSession: mocks.clearRunningSessionMock,
  isGoogleSyncClientEnabled: mocks.isEnabledMock,
  getGoogleSyncBaseUrl: mocks.getBaseUrlMock,
}));

vi.mock('@infra/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mocks.getSessionMock,
    },
  }),
}));

vi.mock('@infra/auth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'user-1' },
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const buildSession = (): TimeTrackerSession => ({
  id: 'session-1',
  title: 'Focus Work',
  startedAt: Date.UTC(2025, 9, 12, 12, 0, 0),
  endedAt: Date.UTC(2025, 9, 12, 13, 0, 0),
  durationSeconds: 3600,
  project: 'Project Alpha',
  notes: 'Deep work',
});

describe('useGoogleSpreadsheetSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.syncSessionMock.mockResolvedValue({
      id: 'log-1',
      sessionId: 'session-1',
      status: 'success',
      attemptedAt: new Date().toISOString(),
      retryCount: 0,
    });
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'supabase-access-token',
        },
      },
      error: null,
    });
    mocks.clearRunningSessionMock.mockResolvedValue({ status: 'ok' });
  });

  it('returns success status after syncing a session', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoogleSpreadsheetSync(), {
      wrapper,
    });

    await act(async () => {
      await result.current.syncSession(buildSession());
    });

    expect(mocks.syncSessionMock).toHaveBeenCalledWith(
      'supabase-access-token',
      expect.objectContaining({
        session: expect.objectContaining({
          id: 'session-1',
          title: 'Focus Work',
          durationSeconds: 3600,
          startedAt: '2025-10-12T12:00:00.000Z',
          endedAt: '2025-10-12T13:00:00.000Z',
        }),
      }),
    );

    await waitFor(() =>
      expect(result.current.state.status).toBe('success'),
    );
    expect(result.current.state.lastSessionId).toBe('session-1');
    expect(result.current.state.error).toBeNull();
  });

  it('captures errors when sync fails', async () => {
    const wrapper = createWrapper();
    const error = new Error('append failed');
    mocks.syncSessionMock.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useGoogleSpreadsheetSync(), {
      wrapper,
    });

    await act(async () => {
      await result.current.syncSession(buildSession());
    });

    await waitFor(() =>
      expect(result.current.state.status).toBe('error'),
    );
    expect(result.current.state.error).toBe('append failed');
  });
});
