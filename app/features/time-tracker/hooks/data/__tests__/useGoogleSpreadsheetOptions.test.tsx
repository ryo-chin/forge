import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleSyncSettings } from '@features/time-tracker/domain/googleSyncTypes';
import { useGoogleSpreadsheetOptions } from '../useGoogleSpreadsheetOptions';

const mocks = vi.hoisted(() => {
  const fetchSettings = vi.fn();
  const updateSettings = vi.fn();
  const listSpreadsheets = vi.fn();
  const listSheets = vi.fn();
  const startOAuth = vi.fn();
  return {
    fetchSettings,
    updateSettings,
    listSpreadsheets,
    listSheets,
    startOAuth,
  };
});

vi.mock('@infra/google/googleSyncClient.ts', () => ({
  fetchSettings: mocks.fetchSettings,
  updateSettings: mocks.updateSettings,
  listSpreadsheets: mocks.listSpreadsheets,
  listSheets: mocks.listSheets,
  startOAuth: mocks.startOAuth,
  isGoogleSyncClientEnabled: () => true,
}));

const getSessionMock = vi.fn();

vi.mock('@infra/supabase/client.ts', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: getSessionMock,
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

const mockSettings = (
  overrides: Partial<GoogleSyncSettings> = {},
): GoogleSyncSettings => ({
  connectionStatus: 'active',
  spreadsheet: {
    id: 'spreadsheet-1',
    name: 'TimeTracker',
    url: 'https://docs.google.com/spreadsheets/d/spreadsheet-1',
    sheetId: 1,
    sheetTitle: 'Sheet1',
  },
  columnMapping: {
    mappings: {
      title: 'A',
      startedAt: 'B',
      endedAt: 'C',
      durationSeconds: 'D',
    },
    requiredColumns: ['title', 'startedAt', 'endedAt', 'durationSeconds'],
    optionalColumns: ['project'],
  },
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('useGoogleSpreadsheetOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchSettings.mockResolvedValue(mockSettings());
    mocks.updateSettings.mockResolvedValue(mockSettings());
    mocks.listSpreadsheets.mockResolvedValue({
      items: [
        {
          id: 'spreadsheet-1',
          name: 'TimeTracker',
          url: 'https://docs.google.com/spreadsheets/d/spreadsheet-1',
        },
      ],
    });
    mocks.listSheets.mockResolvedValue({
      items: [
        { sheetId: 1, title: 'Sheet1', index: 0 },
        { sheetId: 2, title: 'Sheet2', index: 1 },
      ],
    });
    mocks.startOAuth.mockResolvedValue({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/auth?foo=bar',
    });
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'supabase-access-token',
        },
      },
      error: null,
    });
  });

  it('fetches settings on mount', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoogleSpreadsheetOptions(), {
      wrapper,
    });

    await waitFor(() => {
      expect(mocks.fetchSettings).toHaveBeenCalledWith('supabase-access-token');
      expect(getSessionMock).toHaveBeenCalled();
    });

    const refreshed = await act(async () => result.current.settings.refetch());
    expect(refreshed.data?.spreadsheet?.id).toBe('spreadsheet-1');
  });

  it('updates selection and merges new settings', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoogleSpreadsheetOptions(), {
      wrapper,
    });

    const updatedSettings = mockSettings({
      spreadsheet: {
        id: 'spreadsheet-2',
        name: 'Report',
        url: 'https://docs.google.com/spreadsheets/d/spreadsheet-2',
        sheetId: 3,
        sheetTitle: 'Summary',
      },
    });
    mocks.updateSettings.mockResolvedValueOnce(updatedSettings);

    await act(async () => {
      await result.current.updateSelection({
        spreadsheetId: 'spreadsheet-2',
        sheetId: 3,
        sheetTitle: 'Summary',
        columnMapping: {
          title: 'A',
          startedAt: 'B',
          endedAt: 'C',
          durationSeconds: 'D',
        },
      });
    });

    expect(mocks.updateSettings).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        spreadsheetId: 'spreadsheet-2',
        sheetId: 3,
        sheetTitle: 'Summary',
      }),
    );
    await waitFor(() =>
      expect(result.current.settings.data?.spreadsheet?.id).toBe('spreadsheet-2'),
    );
  });

  it('fetches spreadsheet list and sheet list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoogleSpreadsheetOptions(), {
      wrapper,
    });

    const spreadsheets = await result.current.fetchSpreadsheets('Tracker');
    expect(mocks.listSpreadsheets).toHaveBeenCalledWith(
      'supabase-access-token',
      'Tracker',
    );
    expect(spreadsheets.items).toHaveLength(1);

    const sheets = await result.current.fetchSheets('spreadsheet-1');
    expect(mocks.listSheets).toHaveBeenCalledWith(
      'supabase-access-token',
      'spreadsheet-1',
    );
    expect(sheets.items[0]?.title).toBe('Sheet1');
  });

  it('starts OAuth flow and returns authorization url', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoogleSpreadsheetOptions(), {
      wrapper,
    });

    const response = await result.current.startOAuth('/app/dashboard');
    expect(mocks.startOAuth).toHaveBeenCalledWith(
      'supabase-access-token',
      '/app/dashboard',
    );
    expect(response.authorizationUrl).toContain('https://accounts.google.com');
  });
});
