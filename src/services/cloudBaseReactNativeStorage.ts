type SynchronousStorage = {
  readonly length: number;
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

type GlobalWithWebStorage = typeof globalThis & {
  localStorage?: SynchronousStorage;
  sessionStorage?: SynchronousStorage;
};

function createMemoryStorage(): SynchronousStorage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

export function ensureCloudBaseReactNativeStorage() {
  const runtime = globalThis as GlobalWithWebStorage;
  if (typeof runtime.localStorage === 'undefined') {
    Object.defineProperty(runtime, 'localStorage', {
      configurable: true,
      value: createMemoryStorage(),
    });
  }
  if (typeof runtime.sessionStorage === 'undefined') {
    Object.defineProperty(runtime, 'sessionStorage', {
      configurable: true,
      value: createMemoryStorage(),
    });
  }
}
