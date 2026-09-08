/**
 * The checksum only works if both ends compute it identically.
 *
 * Client and server keep separate copies because the relay builds as a
 * standalone package and cannot import from the app. This pins the two
 * implementations to each other, so a change to one that is not mirrored fails
 * here rather than silently turning every session into a resync loop.
 */
import { describe, expect, it } from "vitest";
import { snapshotChecksum as clientChecksum } from "../utils/snapshotChecksum";
import { snapshotChecksum as serverChecksum } from "../../../../server/src/snapshotChecksum";

const layoutA = { elementId: "a", x: 10, y: 20, width: 180, height: 90 };
const layoutB = { elementId: "b", x: -5, y: 7.5, width: 180, height: 90 };

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    diagramId: "ignored",
    diagramName: "Diagram",
    level: "context",
    domain: "",
    description: "",
    components: { a: { id: "a", name: "A", type: "system", parentId: null } },
    connections: {},
    flows: {},
    iconLibrary: {},
    nodeLayouts: { a: layoutA, b: layoutB },
    edgeLayouts: {},
    scenes: {},
    activeSceneId: null,
    compareSceneId: null,
    ...overrides,
  };
}

describe("snapshotChecksum parity", () => {
  it("agrees between client and server on a realistic snapshot", () => {
    expect(clientChecksum(snapshot())).toBe(serverChecksum(snapshot()));
  });

  it("agrees on an empty snapshot and on null", () => {
    expect(clientChecksum({})).toBe(serverChecksum({}));
    expect(clientChecksum(null)).toBe(serverChecksum(null));
  });

  it("agrees when a peer built the same entity with a different key order", () => {
    const reordered = { height: 90, width: 180, y: 20, x: 10, elementId: "a" };
    expect(clientChecksum(snapshot({ nodeLayouts: { a: reordered, b: layoutB } }))).toBe(
      serverChecksum(snapshot()),
    );
  });
});

describe("snapshotChecksum", () => {
  it("changes when a single entity moves", () => {
    const moved = { ...layoutA, x: 11 };
    expect(clientChecksum(snapshot({ nodeLayouts: { a: moved, b: layoutB } }))).not.toBe(
      clientChecksum(snapshot()),
    );
  });

  it("changes when an entity is removed", () => {
    expect(clientChecksum(snapshot({ nodeLayouts: { a: layoutA } }))).not.toBe(
      clientChecksum(snapshot()),
    );
  });

  it("ignores fields a patch cannot carry", () => {
    expect(clientChecksum(snapshot({ diagramId: "other", level: "container" }))).toBe(
      clientChecksum(snapshot()),
    );
  });

  it("treats an absent optional field and an undefined one as the same", () => {
    const withUndefined = snapshot({ domain: undefined });
    const without = snapshot();
    delete (without as Record<string, unknown>).domain;
    expect(clientChecksum(withUndefined)).toBe(clientChecksum(without));
  });
});
