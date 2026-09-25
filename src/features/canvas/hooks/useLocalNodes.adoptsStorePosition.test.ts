import { describe, expect, it } from "vitest";
import { adoptsStorePosition } from "./useLocalNodes";

/**
 * A sidecar tab moves to its compact workload's edge and back without its
 * parent changing; the editor's local nodes used to keep the old place.
 */
describe("adoptsStorePosition", () => {
  it("keeps the local place of a draggable node under the same parent", () => {
    expect(
      adoptsStorePosition({ parentId: "w", draggable: true }, { parentId: "w", draggable: true }),
    ).toBe(false);
    expect(adoptsStorePosition({ parentId: "w" }, { parentId: "w" })).toBe(false);
  });

  it("takes the store's on a reparent", () => {
    expect(adoptsStorePosition({ parentId: "a" }, { parentId: "b" })).toBe(true);
  });

  it("takes the store's when the node cannot be dragged, or just stopped or started being draggable", () => {
    expect(
      adoptsStorePosition({ parentId: "w", draggable: false }, { parentId: "w", draggable: true }),
    ).toBe(true);
    expect(
      adoptsStorePosition({ parentId: "w", draggable: true }, { parentId: "w", draggable: false }),
    ).toBe(true);
  });
});
