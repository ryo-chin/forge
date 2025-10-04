import { useCallback, useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createTimeTrackerDataSource } from '@infra/repository/TimeTracker';
import type { TimeTrackerSession } from '@features/time-tracker/domain/types.ts';
import type { TimeTrackerDataSource } from '@infra/repository/TimeTracker';

const defaultNow = () => Date.now();

export const TIME_TRACKER_SESSIONS_QUERY_KEY = ['time-tracker', 'sessions'] as const;

type SessionsUpdater =
  | TimeTrackerSession[]
  | ((prev: TimeTrackerSession[]) => TimeTrackerSession[]);

export const useSessions = (now: () => number = defaultNow) => {
  const queryClient = useQueryClient();
  const dataSource = useMemo<TimeTrackerDataSource>(
    () => createTimeTrackerDataSource({ now }),
    [now],
  );

  const sessionsQuery = useQuery({
    queryKey: TIME_TRACKER_SESSIONS_QUERY_KEY,
    queryFn: dataSource.fetchSessions,
    initialData: dataSource.initialSessions,
    staleTime: Infinity,
  });

  const persistSessionsMutation = useMutation({
    mutationFn: async (sessions: TimeTrackerSession[]) => {
      await dataSource.persistSessions(sessions);
      return sessions;
    },
    onMutate: async (nextSessions) => {
      const previousSessions =
        (queryClient.getQueryData(TIME_TRACKER_SESSIONS_QUERY_KEY) as
          | TimeTrackerSession[]
          | undefined) ?? dataSource.initialSessions;
      return { previousSessions, nextSessions };
    },
    onError: (_error, _sessions, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(
          TIME_TRACKER_SESSIONS_QUERY_KEY,
          context.previousSessions,
        );
      }
    },
    onSuccess: (sessions) => {
      queryClient.setQueryData(TIME_TRACKER_SESSIONS_QUERY_KEY, sessions);
    },
  });

  const setSessions = useCallback(
    (updater: SessionsUpdater) => {
      let nextValue: TimeTrackerSession[] | undefined;
      queryClient.setQueryData(TIME_TRACKER_SESSIONS_QUERY_KEY, (current) => {
        const base =
          (current as TimeTrackerSession[] | undefined) ??
          dataSource.initialSessions;
        nextValue =
          typeof updater === 'function'
            ? (updater as (prev: TimeTrackerSession[]) => TimeTrackerSession[])(
                base,
              )
            : updater;
        return nextValue;
      });
      return nextValue ?? dataSource.initialSessions;
    },
    [dataSource.initialSessions, queryClient],
  );

  const persistSessions = useCallback(
    (sessions?: TimeTrackerSession[]) => {
      const target =
        sessions ??
        ((queryClient.getQueryData(TIME_TRACKER_SESSIONS_QUERY_KEY) as
          | TimeTrackerSession[]
          | undefined) ?? dataSource.initialSessions);
      persistSessionsMutation.mutate(target);
    },
    [dataSource.initialSessions, persistSessionsMutation, queryClient],
  );

  return {
    mode: dataSource.mode,
    sessions: sessionsQuery.data ?? dataSource.initialSessions,
    setSessions,
    persistSessions,
  };
};
