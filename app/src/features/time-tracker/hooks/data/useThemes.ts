import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createThemeRepository,
  type ThemeRepository,
} from '../../../../infra/repository/TimeTracker';
import type {
  TimeTrackerTheme,
  TimeTrackerThemeStatus,
} from '../../domain/types.ts';

const THEMES_QUERY_KEY = ['time-tracker', 'themes'] as const;

type UseThemesOptions = {
  ownerId?: string | null;
};

type CreateThemeInput = {
  name: string;
  color?: string;
  description?: string;
};

type UpdateThemeInput = {
  id: string;
  name?: string;
  color?: string | null;
  description?: string | null;
  status?: TimeTrackerThemeStatus;
};

export const useThemes = (options: UseThemesOptions = {}) => {
  const ownerId = options.ownerId ?? null;
  const repository = useMemo<ThemeRepository>(() => createThemeRepository(), []);
  const queryClient = useQueryClient();

  const resolvedOwnerId = ownerId && ownerId.trim().length > 0 ? ownerId : null;

  const queryKey = useMemo(
    () => [...THEMES_QUERY_KEY, resolvedOwnerId ?? 'anonymous'] as const,
    [resolvedOwnerId],
  );

  const themesQuery = useQuery({
    queryKey,
    queryFn: () => repository.listThemes(resolvedOwnerId ?? undefined),
    staleTime: Infinity,
  });

  const invalidateThemes = () =>
    queryClient.invalidateQueries({ queryKey, exact: true });

  const createThemeMutation = useMutation({
    mutationFn: (payload: CreateThemeInput) =>
      repository.createTheme(resolvedOwnerId ?? undefined, payload),
    onSuccess: () => invalidateThemes(),
  });

  const updateThemeMutation = useMutation({
    mutationFn: ({ id, ...patch }: UpdateThemeInput) =>
      repository.updateTheme(resolvedOwnerId ?? undefined, id, patch),
    onSuccess: () => invalidateThemes(),
  });

  const archiveThemeMutation = useMutation({
    mutationFn: (id: string) =>
      repository.archiveTheme(resolvedOwnerId ?? undefined, id),
    onSuccess: () => invalidateThemes(),
  });

  return {
    themes: (themesQuery.data ?? []) as TimeTrackerTheme[],
    isLoading: themesQuery.isLoading,
    error: themesQuery.error,
    createTheme: createThemeMutation.mutateAsync,
    updateTheme: updateThemeMutation.mutateAsync,
    archiveTheme: archiveThemeMutation.mutateAsync,
    isCreating: createThemeMutation.isPending,
    isUpdating: updateThemeMutation.isPending,
    isArchiving: archiveThemeMutation.isPending,
  };
};
