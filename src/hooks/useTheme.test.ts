import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The theme a first visit gets. `useTheme` reads and applies it when the
 * module is evaluated, so each case imports a fresh copy.
 */

function preferDark(dark: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: dark && query.includes("dark"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

async function freshTheme() {
  vi.resetModules();
  const { useTheme } = await import("./useTheme");
  const { renderHook } = await import("@testing-library/react");
  return renderHook(() => useTheme()).result.current.theme;
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("the default theme", () => {
  it("is light on a first visit, even when the system prefers dark", async () => {
    localStorage.clear();
    preferDark(true);
    expect(await freshTheme()).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("is the one the user chose, once they chose", async () => {
    localStorage.setItem("structura_theme", "dark");
    preferDark(false);
    expect(await freshTheme()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
