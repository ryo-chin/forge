import { detectTimeDataSourceMode } from '@infra/config';
import { getSupabaseClient } from '@infra/supabase';
import type { Database } from '@infra/supabase';
import type {
  TimeTrackerTheme,
  TimeTrackerThemeStatus,
} from '../../../features/time-tracker/domain/types.ts';
import {
  loadThemesForOwner,
  saveThemesForOwner,
  type StoredTheme,
} from '@infra/localstorage';

type ThemePayload = {
  name: string;
  color?: string;
  description?: string;
};

type ThemeUpdatePayload = {
  name?: string;
  color?: string | null;
  description?: string | null;
  status?: TimeTrackerThemeStatus;
};

const DEFAULT_OWNER_ID = 'local-owner';

const resolveOwnerId = (ownerId?: string | null) =>
  ownerId && ownerId.trim().length > 0 ? ownerId : DEFAULT_OWNER_ID;

const mapStoredThemeToDomain = (theme: StoredTheme): TimeTrackerTheme => ({
  id: theme.id,
  ownerId: theme.ownerId,
  name: theme.name,
  status: theme.status,
  createdAt: theme.createdAt,
  updatedAt: theme.updatedAt,
  color: theme.color,
  description: theme.description,
});

const createLocalThemeRepository = () => ({
  async listThemes(ownerId: string): Promise<TimeTrackerTheme[]> {
    return loadThemesForOwner(ownerId).map(mapStoredThemeToDomain);
  },
  async createTheme(
    ownerId: string,
    payload: ThemePayload,
  ): Promise<TimeTrackerTheme> {
    const themes = loadThemesForOwner(ownerId);
    const now = Date.now();
    const newTheme: StoredTheme = {
      id: crypto.randomUUID(),
      ownerId,
      name: payload.name,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      color: payload.color,
      description: payload.description,
    };
    const next = [...themes, newTheme];
    saveThemesForOwner(ownerId, next);
    return mapStoredThemeToDomain(newTheme);
  },
  async updateTheme(
    ownerId: string,
    id: string,
    patch: ThemeUpdatePayload,
  ): Promise<TimeTrackerTheme> {
    const themes = loadThemesForOwner(ownerId);
    const index = themes.findIndex((theme) => theme.id === id);
    if (index === -1) {
      throw new Error(`[themeRepository] Theme not found: ${id}`);
    }
    const target = themes[index];
    const updated: StoredTheme = {
      ...target,
      name: patch.name ?? target.name,
      color:
        patch.color === null
          ? undefined
          : patch.color !== undefined
          ? patch.color
          : target.color,
      description:
        patch.description === null
          ? undefined
          : patch.description !== undefined
          ? patch.description
          : target.description,
      status: patch.status ?? target.status,
      updatedAt: Date.now(),
    };
    const next = [...themes];
    next[index] = updated;
    saveThemesForOwner(ownerId, next);
    return mapStoredThemeToDomain(updated);
  },
});

type ThemeRow = Database['public']['Tables']['time_tracker_themes']['Row'];
type ThemeInsert =
  Database['public']['Tables']['time_tracker_themes']['Insert'];

const createSupabaseThemeRepository = () => {
  const supabase = getSupabaseClient();
  const themesTable = () => supabase.from('time_tracker_themes');

  return {
    async listThemes(ownerId: string): Promise<TimeTrackerTheme[]> {
      const { data, error } = await themesTable()
        .select('id,owner_id,name,status,created_at,updated_at,color,description')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: true })
        .overrideTypes<ThemeRow[]>();
      if (error) {
        throw error;
      }
      return ((data ?? []) as ThemeRow[]).map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        status: row.status,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        color: row.color ?? undefined,
        description: row.description ?? undefined,
      }));
    },
    async createTheme(
      ownerId: string,
      payload: ThemePayload,
    ): Promise<TimeTrackerTheme> {
      const now = new Date().toISOString();
      const record: ThemeInsert = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        name: payload.name,
        status: 'active' as TimeTrackerThemeStatus,
        color: payload.color ?? null,
        description: payload.description ?? null,
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await themesTable()
        .upsert(record, { onConflict: 'id' })
        .select()
        .maybeSingle()
        .overrideTypes<ThemeRow | null>();
      if (error) {
        throw error;
      }
      const row: ThemeRow = (data as ThemeRow | null) ?? (record as ThemeRow);
      return {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        status: row.status,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        color: row.color ?? undefined,
        description: row.description ?? undefined,
      };
    },
    async updateTheme(
      ownerId: string,
      id: string,
      patch: ThemeUpdatePayload,
    ): Promise<TimeTrackerTheme> {
      const updates = {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.color !== undefined
          ? { color: patch.color ?? null }
          : {}),
        ...(patch.description !== undefined
          ? { description: patch.description ?? null }
          : {}),
        ...(patch.status ? { status: patch.status } : {}),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await themesTable()
        .update(updates)
        .eq('id', id)
        .eq('owner_id', ownerId)
        .select()
        .maybeSingle()
        .overrideTypes<ThemeRow | null>();
      if (error) {
        throw error;
      }
      const updatedRow = data as ThemeRow | null;
      if (!updatedRow) {
        throw new Error(`[themeRepository] Theme not found: ${id}`);
      }
      return {
        id: updatedRow.id,
        ownerId: updatedRow.owner_id,
        name: updatedRow.name,
        status: updatedRow.status,
        createdAt: new Date(updatedRow.created_at).getTime(),
        updatedAt: new Date(updatedRow.updated_at).getTime(),
        color: updatedRow.color ?? undefined,
        description: updatedRow.description ?? undefined,
      };
    },
  };
};

export const createThemeRepository = () => {
  const mode = detectTimeDataSourceMode();
  if (mode === 'supabase') {
    const supRepo = createSupabaseThemeRepository();
    return {
      listThemes: async (ownerId?: string | null) =>
        supRepo.listThemes(resolveOwnerId(ownerId)),
      createTheme: async (ownerId: string | null | undefined, payload: ThemePayload) =>
        supRepo.createTheme(resolveOwnerId(ownerId), payload),
      updateTheme: async (
        ownerId: string | null | undefined,
        id: string,
        patch: ThemeUpdatePayload,
      ) => supRepo.updateTheme(resolveOwnerId(ownerId), id, patch),
      archiveTheme: async (ownerId: string | null | undefined, id: string) =>
        supRepo.updateTheme(resolveOwnerId(ownerId), id, {
          status: 'archived',
        }),
    };
  }

  const localRepo = createLocalThemeRepository();
  return {
    listThemes: async (ownerId?: string | null) =>
      localRepo.listThemes(resolveOwnerId(ownerId)),
    createTheme: async (ownerId: string | null | undefined, payload: ThemePayload) =>
      localRepo.createTheme(resolveOwnerId(ownerId), payload),
    updateTheme: async (
      ownerId: string | null | undefined,
      id: string,
      patch: ThemeUpdatePayload,
    ) => localRepo.updateTheme(resolveOwnerId(ownerId), id, patch),
    archiveTheme: async (ownerId: string | null | undefined, id: string) =>
      localRepo.updateTheme(resolveOwnerId(ownerId), id, {
        status: 'archived',
      }),
  };
};

export type ThemeRepository = ReturnType<typeof createThemeRepository>;
