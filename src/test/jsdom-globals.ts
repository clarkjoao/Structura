/**
 * Browser globals jsdom does not provide, installed before anything else.
 *
 * Kept in its own module because import order is the only lever available:
 * ESM evaluates every import of `setup.tsx` before its first statement, so a
 * mock written as a statement there lands too late for any module that reads
 * the global while it is being evaluated (`hooks/useTheme` reads `matchMedia`
 * at module scope). Importing this file first is what makes the ordering
 * explicit instead of accidental.
 */

const localStorageMock = (() => {
  let store: Record<string, string> = {};
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
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
  writable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null as MediaQueryList["onchange"],
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
