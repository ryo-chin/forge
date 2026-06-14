// 汎用 JSON 配列ストレージ（local モードの予実・デイリー記録で共有）

export const loadJsonList = <T>(key: string, parse: (value: unknown) => T | null): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => parse(entry)).filter((entry): entry is T => entry !== null);
  } catch (error) {
    console.warn(`Failed to load ${key}`, error);
    return [];
  }
};

export const saveJsonList = <T>(key: string, items: T[]): void => {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(items));
    }
  } catch (error) {
    console.warn(`Failed to persist ${key}`, error);
  }
};
