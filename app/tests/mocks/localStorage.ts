/**
 * localStorage のモック実装
 * jsdom環境でもlocalStorageを制御可能にする
 */

type StorageData = Record<string, string>;

export function createMockLocalStorage(initialData: StorageData = {}): Storage {
  let store: StorageData = { ...initialData };

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

/**
 * グローバルlocalStorageをモックに置き換え、クリーンアップ関数を返す
 */
export function setupMockLocalStorage(initialData: StorageData = {}): () => void {
  const originalLocalStorage = globalThis.localStorage;
  const mockStorage = createMockLocalStorage(initialData);

  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });

  return () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  };
}
