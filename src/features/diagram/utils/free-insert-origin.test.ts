import { describe, expect, it } from "vitest";
import { FREE_ORIGIN_GAP, freeInsertOrigin } from "./free-insert-origin";

const size = { width: 600, height: 200 };

describe("freeInsertOrigin", () => {
  it("keeps the origin when nothing is in the way", () => {
    expect(
      freeInsertOrigin({ x: 10, y: 20 }, size, [{ x: 0, y: 500, width: 100, height: 50 }]),
    ).toEqual({
      x: 10,
      y: 20,
    });
  });

  it("moves right of whatever the fragment would cover", () => {
    const occupied = [{ x: 100, y: 50, width: 200, height: 80 }];
    expect(freeInsertOrigin({ x: 0, y: 0 }, size, occupied)).toEqual({
      x: 300 + FREE_ORIGIN_GAP,
      y: 0,
    });
  });

  it("keeps moving until the whole fragment is clear", () => {
    const occupied = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 300, y: 0, width: 100, height: 100 },
      { x: 800, y: 150, width: 50, height: 50 },
    ];
    const at = freeInsertOrigin({ x: 0, y: 0 }, size, occupied);
    for (const box of occupied) {
      const clear = at.x >= box.x + box.width || at.x + size.width <= box.x;
      expect(clear || at.y + size.height <= box.y || at.y >= box.y + box.height).toBe(true);
    }
    expect(at.y).toBe(0);
  });
});
