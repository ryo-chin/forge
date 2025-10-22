import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRunningSession } from '../useRunningSession';
import type { TimeTrackerDataSource } from '../../../../../infra/repository/TimeTracker';
import type { RunningSessionState } from '../../../domain/types';

// モック用のデータソース
const createMockDataSource = (
  overrides?: Partial<TimeTrackerDataSource>,
): TimeTrackerDataSource => ({
  mode: 'supabase',
  initialSessions: [],
  initialRunningState: null,
  fetchSessions: vi.fn().mockResolvedValue([]),
  fetchRunningState: vi.fn().mockResolvedValue(null),
  persistSessions: vi.fn().mockResolvedValue(undefined),
  persistRunningState: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// createTimeTrackerDataSourceをモック
vi.mock('../../../../../infra/repository/TimeTracker', () => ({
  createTimeTrackerDataSource: vi.fn(),
}));

describe('useRunningSession - Supabase Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch running state on mount', async () => {
    const mockRunningState: RunningSessionState = {
      status: 'running',
      draft: {
        id: 'test-session-id',
        title: 'Test Session',
        startedAt: Date.now() - 10000,
        tags: ['test'],
      },
      elapsedSeconds: 10,
    };

    const mockDataSource = createMockDataSource({
      initialRunningState: mockRunningState,
      fetchRunningState: vi.fn().mockResolvedValue(mockRunningState),
    });

    const { createTimeTrackerDataSource } = await import(
      '../../../../../infra/repository/TimeTracker'
    );
    vi.mocked(createTimeTrackerDataSource).mockReturnValue(mockDataSource);

    const { result } = renderHook(() =>
      useRunningSession({ userId: 'user-1' }),
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe('running');
    });

    expect(result.current.state.draft?.title).toBe('Test Session');
    expect(result.current.state.draft?.id).toBe('test-session-id');
    expect(result.current.state.elapsedSeconds).toBe(10);
  });

  it('should persist running state when session starts', async () => {
    const mockDataSource = createMockDataSource();

    const { createTimeTrackerDataSource } = await import(
      '../../../../../infra/repository/TimeTracker'
    );
    vi.mocked(createTimeTrackerDataSource).mockReturnValue(mockDataSource);

    const { result } = renderHook(() =>
      useRunningSession({ userId: 'user-1' }),
    );

    // セッション開始
    await act(async () => {
      result.current.start('New Session');
    });

    await waitFor(() => {
      expect(mockDataSource.persistRunningState).toHaveBeenCalledTimes(1);
    });

    const persistedState =
      vi.mocked(mockDataSource.persistRunningState).mock.calls[0][0];
    expect(persistedState.status).toBe('running');
    expect(persistedState.draft?.title).toBe('New Session');
    expect(persistedState.draft?.id).toBeDefined();
  });

  it('should persist state when draft is updated', async () => {
    const mockDataSource = createMockDataSource();

    const { createTimeTrackerDataSource } = await import(
      '../../../../../infra/repository/TimeTracker'
    );
    vi.mocked(createTimeTrackerDataSource).mockReturnValue(mockDataSource);

    const { result } = renderHook(() =>
      useRunningSession({ userId: 'user-1' }),
    );

    // セッション開始
    await act(async () => {
      result.current.start('Session');
    });

    await waitFor(() => {
      expect(mockDataSource.persistRunningState).toHaveBeenCalled();
    });

    vi.clearAllMocks();

    // ドラフト更新
    await act(async () => {
      result.current.updateDraft({ project: 'Test Project' });
    });

    await waitFor(() => {
      expect(mockDataSource.persistRunningState).toHaveBeenCalled();
    });

    const persistedState =
      vi.mocked(mockDataSource.persistRunningState).mock.calls[0][0];
    expect(persistedState.draft?.project).toBe('Test Project');
  });

  it('should allow manual persistence via persistRunningState', async () => {
    const mockDataSource = createMockDataSource();

    const { createTimeTrackerDataSource } = await import(
      '../../../../../infra/repository/TimeTracker'
    );
    vi.mocked(createTimeTrackerDataSource).mockReturnValue(mockDataSource);

    const { result } = renderHook(() =>
      useRunningSession({ userId: 'user-1' }),
    );

    await act(async () => {
      result.current.start('Manual Persist Session');
    });

    await waitFor(() => {
      expect(mockDataSource.persistRunningState).toHaveBeenCalled();
    });

    vi.mocked(mockDataSource.persistRunningState).mockClear();

    await act(async () => {
      await result.current.persistRunningState();
    });

    expect(mockDataSource.persistRunningState).toHaveBeenCalled();
  });

  it('should persist state when title is updated', async () => {
    const mockDataSource = createMockDataSource();

    const { createTimeTrackerDataSource } = await import(
      '../../../../../infra/repository/TimeTracker'
    );
    vi.mocked(createTimeTrackerDataSource).mockReturnValue(mockDataSource);

    const { result } = renderHook(() =>
      useRunningSession({ userId: 'user-1' }),
    );

    await act(async () => {
      result.current.start('Original Title');
    });

    vi.mocked(mockDataSource.persistRunningState).mockClear();

    await act(async () => {
      result.current.updateDraft({ title: 'Updated Title' });
    });

    await waitFor(() => {
      expect(mockDataSource.persistRunningState).toHaveBeenCalled();
    });

    const persistedState =
      vi.mocked(mockDataSource.persistRunningState).mock.calls[0][0];
    expect(persistedState.status).toBe('running');
    expect(persistedState.draft?.title).toBe('Updated Title');
  });

  it('should restore state from remote on mount if different', async () => {
    const remoteState: RunningSessionState = {
      status: 'running',
      draft: {
        id: 'remote-session-id',
        title: 'Remote Session',
        startedAt: Date.now() - 5000,
        project: 'Remote Project',
      },
      elapsedSeconds: 5,
    };

    const mockDataSource = createMockDataSource({
      fetchRunningState: vi.fn().mockResolvedValue(remoteState),
    });

    const { createTimeTrackerDataSource } = await import(
      '../../../../../infra/repository/TimeTracker'
    );
    vi.mocked(createTimeTrackerDataSource).mockReturnValue(mockDataSource);

    const { result } = renderHook(() =>
      useRunningSession({ userId: 'user-1' }),
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe('running');
    });

    expect(result.current.state.draft?.title).toBe('Remote Session');
    expect(result.current.state.draft?.project).toBe('Remote Project');
    expect(mockDataSource.fetchRunningState).toHaveBeenCalled();
  });

  it('should not persist state when userId is missing in supabase mode', async () => {
    const mockDataSource = createMockDataSource();

    const { createTimeTrackerDataSource } = await import(
      '../../../../../infra/repository/TimeTracker'
    );
    vi.mocked(createTimeTrackerDataSource).mockReturnValue(mockDataSource);

    const { result } = renderHook(() => useRunningSession({ userId: null }));

    await act(async () => {
      result.current.start('Session');
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockDataSource.persistRunningState).not.toHaveBeenCalled();
  });
});
