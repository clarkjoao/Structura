import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kvGetItem, kvSetItem } from "@/infrastructure/persistence/kvStorage";
import { useRecentDiagrams } from "./useRecentDiagrams";
import {
  readSidebarExpandedFolderIds,
  writeSidebarExpandedFolderIds,
} from "./sidebarFolderStorage";

const RECENT_KEY = "structura:recentDiagrams";
const FOLDERS_KEY = "structura:sidebarFolders";

const stored = () => JSON.parse(kvGetItem(RECENT_KEY) ?? "[]") as { id: string }[];

describe("useRecentDiagrams", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    kvSetItem(RECENT_KEY, "[]");
  });
  afterEach(() => vi.useRealTimers());

  it("records the newest first, moves a reopened diagram to the front and caps the list at 5", () => {
    const { result } = renderHook(() => useRecentDiagrams());
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      vi.advanceTimersByTime(10);
      act(() => result.current.recordOpened(id));
    }
    expect(result.current.recent.map((r) => r.id)).toEqual(["f", "e", "d", "c", "b"]);
    act(() => result.current.recordOpened("c"));
    expect(result.current.recent.map((r) => r.id)).toEqual(["c", "f", "e", "d", "b"]);
    expect(stored().map((r) => r.id)).toEqual(["c", "f", "e", "d", "b"]);
  });

  it("starts from what was persisted and removes an entry from both state and storage", () => {
    kvSetItem(
      RECENT_KEY,
      JSON.stringify([
        { id: "x", openedAt: 1 },
        { id: "y", openedAt: 2 },
      ]),
    );
    const { result } = renderHook(() => useRecentDiagrams());
    expect(result.current.recent.map((r) => r.id)).toEqual(["x", "y"]);
    act(() => result.current.removeRecent("x"));
    expect(result.current.recent.map((r) => r.id)).toEqual(["y"]);
    expect(stored().map((r) => r.id)).toEqual(["y"]);
  });

  it("ignores a corrupt or malformed stored list", () => {
    kvSetItem(RECENT_KEY, "{not json");
    expect(renderHook(() => useRecentDiagrams()).result.current.recent).toEqual([]);
    kvSetItem(RECENT_KEY, JSON.stringify([{ id: 1 }, { id: "ok", openedAt: 3 }, null]));
    expect(renderHook(() => useRecentDiagrams()).result.current.recent).toEqual([
      { id: "ok", openedAt: 3 },
    ]);
  });
});

describe("sidebarFolderStorage", () => {
  it("round-trips the expanded folder ids", () => {
    writeSidebarExpandedFolderIds(new Set(["f1", "f2"]));
    expect([...readSidebarExpandedFolderIds()].sort()).toEqual(["f1", "f2"]);
  });

  it.each([
    ["nothing stored", null],
    ["invalid json", "{oops"],
    ["not an array", JSON.stringify({ a: 1 })],
  ])("reads an empty set when %s", (_name, raw) => {
    kvSetItem(FOLDERS_KEY, raw ?? "");
    expect(readSidebarExpandedFolderIds().size).toBe(0);
  });

  it("drops non-string entries", () => {
    kvSetItem(FOLDERS_KEY, JSON.stringify(["a", 2, null, "b"]));
    expect([...readSidebarExpandedFolderIds()]).toEqual(["a", "b"]);
  });
});
