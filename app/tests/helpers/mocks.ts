/**
 * モック戦略
 *
 * infra層のモック化パターンを提供する。
 * テストではhooks/data層をモックし、UI/ドメインのテストから
 * ネットワークや永続化の詳細を隠蔽する。
 */

import type { TimeTrackerSession } from '@features/time-tracker';
import { vi } from 'vitest';

/**
 * localStorageのモックを作成する
 */
export function createLocalStorageMock() {
  const store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: store,
  };
}

/**
 * Google Sheets APIのモックレスポンスを作成する
 */
export function createGoogleSheetsApiMock() {
  return {
    syncSession: vi.fn().mockResolvedValue({
      id: 'log-1',
      sessionId: 'session-1',
      status: 'success',
      attemptedAt: new Date().toISOString(),
      retryCount: 0,
    }),
    clearRunningSession: vi.fn().mockResolvedValue({ status: 'ok' }),
    deleteSessionRow: vi.fn().mockResolvedValue({ status: 'ok' }),
  };
}

/**
 * Supabase認証のモックを作成する
 */
export function createAuthMock(
  overrides: Partial<{
    status: 'authenticated' | 'unauthenticated' | 'loading';
    userId: string;
    accessToken: string;
  }> = {},
) {
  const { status = 'authenticated', userId = 'user-1', accessToken = 'test-token' } = overrides;

  return {
    useAuth: () => ({
      status,
      user: status === 'authenticated' ? { id: userId } : null,
    }),
    getAccessToken: vi.fn().mockResolvedValue(accessToken),
  };
}

/**
 * セッションリポジトリのモックを作成する
 */
export function createSessionRepositoryMock(initialSessions: TimeTrackerSession[] = []) {
  let sessions = [...initialSessions];

  return {
    getSessions: vi.fn().mockImplementation(() => Promise.resolve(sessions)),
    saveSession: vi.fn().mockImplementation((session: TimeTrackerSession) => {
      sessions = [...sessions, session];
      return Promise.resolve(session);
    }),
    updateSession: vi.fn().mockImplementation((session: TimeTrackerSession) => {
      sessions = sessions.map((s) => (s.id === session.id ? session : s));
      return Promise.resolve(session);
    }),
    deleteSession: vi.fn().mockImplementation((id: string) => {
      sessions = sessions.filter((s) => s.id !== id);
      return Promise.resolve();
    }),
    _getSessions: () => sessions,
    _reset: () => {
      sessions = [...initialSessions];
    },
  };
}
