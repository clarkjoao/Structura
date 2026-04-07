import { describe, expect, it } from "vitest";
import { randomColor } from "../utils/collab-colors";
import { newCollabRoomId } from "../utils/collab.utils";

const PALETTE = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#f97316",
  "#ec4899",
];

describe("collab-colors", () => {
  it("returns only colors from the fixed palette", () => {
    for (let index = 0; index < 40; index += 1) {
      expect(PALETTE).toContain(randomColor());
    }
  });

  it("palette has enough distinct colors for several simultaneous users", () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
    expect(PALETTE.length).toBeGreaterThanOrEqual(4);
  });
});

describe("collab.utils", () => {
  it("newCollabRoomId returns a non-empty id", () => {
    const roomId = newCollabRoomId();
    expect(roomId.length).toBeGreaterThan(0);
  });
});
