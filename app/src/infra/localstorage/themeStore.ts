const STORAGE_KEY = 'codex-time-tracker/themes-metadata';

type StoredThemeStatus = 'active' | 'archived';

type StoredTheme = {
  id: string;
  ownerId: string;
  name: string;
  status: StoredThemeStatus;
  createdAt: number;
  updatedAt: number;
  color?: string;
  description?: string;
};

type StoredState = Record<string, StoredTheme[]>;

const isBrowser = typeof window !== 'undefined';

const readState = (): StoredState => {
  if (!isBrowser) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as StoredState;
  } catch (error) {
    console.warn('[themeStore] Failed to load themes metadata', error);
    return {};
  }
};

const writeState = (state: StoredState) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[themeStore] Failed to persist themes metadata', error);
  }
};

const DEFAULT_THEME = (ownerId: string): StoredTheme => ({
  id: 'default-theme',
  ownerId,
  name: '経営者鍛錬',
  status: 'active',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const loadThemesForOwner = (ownerId: string): StoredTheme[] => {
  const state = readState();
  const themes = state[ownerId];
  if (!themes || themes.length === 0) {
    const defaultTheme = DEFAULT_THEME(ownerId);
    state[ownerId] = [defaultTheme];
    writeState(state);
    return [defaultTheme];
  }
  return themes;
};

export const saveThemesForOwner = (
  ownerId: string,
  themes: StoredTheme[],
) => {
  const state = readState();
  state[ownerId] = themes;
  writeState(state);
};

export type { StoredTheme, StoredThemeStatus };
