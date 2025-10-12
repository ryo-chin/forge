const ENABLED_KEY = 'VITE_GOOGLE_SYNC_ENABLED';
const BASE_URL_KEY = 'VITE_GOOGLE_SYNC_API_BASE_URL';

const normalizeBoolean = (value: string | undefined): boolean => {
  if (!value) return true;
  const lower = value.trim().toLowerCase();
  if (['false', '0', 'off', 'no'].includes(lower)) {
    return false;
  }
  if (['true', '1', 'on', 'yes'].includes(lower)) {
    return true;
  }
  return true;
};

export const isGoogleSyncEnabled = (): boolean =>
  normalizeBoolean(import.meta.env[ENABLED_KEY]);

export const getGoogleSyncApiBaseUrl = (): string => {
  const raw = import.meta.env[BASE_URL_KEY];
  return typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : '';
};

export const buildGoogleSyncUrl = (path: string): string => {
  const base = getGoogleSyncApiBaseUrl();
  if (!base) {
    return path;
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};
