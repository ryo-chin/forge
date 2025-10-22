import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDraft } from '../../../domain/types';
import { useGoogleSpreadsheetSync } from '../useGoogleSpreadsheetSync';

const mocks = vi.hoisted(() => {
  const appendRunningSession = vi.fn();
  const updateRunningSession = vi.fn();
  const syncSession = vi.fn();
  const isEnabled = vi.fn(() => true);
  const getBaseUrl = vi.fn(() => 'https://worker.example.com');
  const getSession = vi.fn();
  return {
    appendRunningSession,
    updateRunningSession,
    syncSession,
    isEnabled,
    getBaseUrl,
    getSession,
  };
});

vi.mock('@infra/google', () => ({
  isGoogleSyncClientEnabled: mocks.isEnabled,
  getGoogleSyncBaseUrl: mocks.getBaseUrl,
  appendRunningSession: mocks.appendRunningSession,
  updateRunningSession: mocks.updateRunningSession,
  syncSession: mocks.syncSession,
}));

vi.mock('@infra/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mocks.getSession,
    },
  }),
}));

const useAuthMock = vi.fn();
vi.mock('@infra/auth', () => ({
  useAuth: () => useAuthMock(),
}));

global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
} as Storage;

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

const buildRunningDraft = (): SessionDraft => ({
  id: 'running-1',
  title: 'Focus Session',
  startedAt: Date.now() - 60_000,
  project: 'Project A',
  tags: ['tag1', 'tag2'],
});

describe('useGoogleSpreadsheetSync – running session helpers', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      status: 'authenticated',
      user: { id: 'user-1' },
    });

    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'supabase-token' } },
      error: null,
    });

    vi.mocked(localStorage.getItem).mockReturnValue('{"configured":true}');
    mocks.appendRunningSession.mockResolvedValue({ status: 'ok' });
    mocks.updateRunningSession.mockResolvedValue({ status: 'ok' });
  });

  it('calls appendRunningSession when a running session starts', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoogleSpreadsheetSync(), {
      wrapper,
    });

    const draft = buildRunningDraft();

    await act(async () => {
      await result.current.syncRunningSessionStart(draft);
    });

    expect(mocks.appendRunningSession).toHaveBeenCalledWith(
      'supabase-token',
      expect.objectContaining({ id: draft.id, title: draft.title }),
    );
  });

  it('passes elapsed seconds when updating a running session', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoogleSpreadsheetSync(), {
      wrapper,
    });

    const draft = buildRunningDraft();

    await act(async () => {
      await result.current.syncRunningSessionUpdate(draft, 120);
    });

    expect(mocks.updateRunningSession).toHaveBeenCalledWith(
      'supabase-token',
      expect.objectContaining({
        draft: expect.objectContaining({ id: draft.id }),
        elapsedSeconds: 120,
      }),
    );
  });

  it('returns null when Sheets config is missing', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoogleSpreadsheetSync(), {
      wrapper,
    });

    const draft = buildRunningDraft();
    const startResult = await act(async () =>
      result.current.syncRunningSessionStart(draft),
    );

    expect(startResult).toBeNull();
    expect(mocks.appendRunningSession).not.toHaveBeenCalled();
  });

  it('returns null when append fails', async () => {
    const error = new Error('append failed');
    mocks.appendRunningSession.mockRejectedValueOnce(error);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoogleSpreadsheetSync(), {
      wrapper,
    });

    const draft = buildRunningDraft();
    const response = await act(async () =>
      result.current.syncRunningSessionStart(draft),
    );

    expect(response).toBeNull();
  });
});
