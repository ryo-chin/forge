const BASE_URL_KEY = 'VITE_API_BASE_URL';

export const getGoogleSyncApiBaseUrl = (): string => {
  const raw = import.meta.env[BASE_URL_KEY];
  return typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : '';
};

export const isGoogleSyncEnabled = (): boolean => {
  return getGoogleSyncApiBaseUrl() !== '';
};

export const buildGoogleSyncUrl = (path: string): string => {
  const base = getGoogleSyncApiBaseUrl();
  if (!base) {
    return path;
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};
