import { describe, expect, it } from "vitest";
import { SPINE_PAST_WINDOW, SPINE_UPCOMING_WINDOW, windowSpineRows } from "./spineWindow";

const rows = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("windowSpineRows", () => {
  it("keeps the walked steps nearest the one in hand", () => {
    const { shown, hidden } = windowSpineRows(rows(14), "past", false);
    expect(shown).toEqual([12, 13, 14]);
    expect(hidden).toBe(14 - SPINE_PAST_WINDOW);
  });

  it("keeps the upcoming steps that come next", () => {
    const { shown, hidden } = windowSpineRows(rows(20), "upcoming", false);
    expect(shown).toEqual([1, 2, 3, 4, 5]);
    expect(hidden).toBe(20 - SPINE_UPCOMING_WINDOW);
  });

  it("shows a side whole once it is opened", () => {
    expect(windowSpineRows(rows(14), "past", true)).toEqual({ shown: rows(14), hidden: 0 });
  });

  it("does not hide a single row behind a control", () => {
    expect(windowSpineRows(rows(SPINE_PAST_WINDOW + 1), "past", false).hidden).toBe(0);
    expect(windowSpineRows(rows(SPINE_UPCOMING_WINDOW + 1), "upcoming", false).hidden).toBe(0);
  });

  it("leaves a short reading alone", () => {
    expect(windowSpineRows(rows(2), "past", false)).toEqual({ shown: rows(2), hidden: 0 });
  });
});
