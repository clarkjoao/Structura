/**
 * Tests for the per-entity diff that feeds collaboration patches.
 *
 * The property that matters: a patch names only the entities that actually
 * changed. Sending whole collections is what made concurrent edits to
 * different entities overwrite each other, and what put an entire diagram on
 * the wire for every drag.
 */
import { describe, expect, it } from "vitest";
import { diffCollection, diffPatch } from "../hooks/useCollabStoreSync";

const nodeA = { elementId: "a", x: 0, y: 0 };
const nodeB = { elementId: "b", x: 0, y: 0 };

function trackedState(overrides: Record<string, unknown> = {}) {
  return {
    diagramName: "D",
    domain: undefined,
    description: undefined,
    components: {},
    connections: {},
    flows: {},
    iconLibrary: {},
    nodeLayouts: {},
    edgeLayouts: {},
    scenes: {},
    activeSceneId: null,
    compareSceneId: null,
    ...overrides,
  } as Parameters<typeof diffPatch>[0];
}

describe("diffCollection", () => {
  it("returns null when the collection reference is unchanged", () => {
    const collection = { a: nodeA };
    expect(diffCollection(collection, collection)).toBeNull();
  });

  it("returns null when contents are equal by reference", () => {
    expect(diffCollection({ a: nodeA }, { a: nodeA })).toBeNull();
  });

  it("emits only the entity that changed, not its siblings", () => {
    const movedA = { elementId: "a", x: 99, y: 99 };
    const delta = diffCollection({ a: nodeA, b: nodeB }, { a: movedA, b: nodeB });

    expect(delta).toEqual({ a: movedA });
    expect(delta).not.toHaveProperty("b");
  });

  it("emits an added entity", () => {
    expect(diffCollection({ a: nodeA }, { a: nodeA, b: nodeB })).toEqual({ b: nodeB });
  });

  it("emits null as a tombstone for a removed entity", () => {
    expect(diffCollection({ a: nodeA, b: nodeB }, { a: nodeA })).toEqual({ b: null });
  });

  it("handles a removal and an edit in the same delta", () => {
    const movedA = { elementId: "a", x: 5, y: 5 };
    expect(diffCollection({ a: nodeA, b: nodeB }, { a: movedA })).toEqual({
      a: movedA,
      b: null,
    });
  });
});

describe("diffPatch", () => {
  it("returns null when nothing changed", () => {
    const state = trackedState();
    expect(diffPatch(state, state)).toBeNull();
  });

  it("sends one entity rather than the whole collection when a node moves", () => {
    const movedA = { elementId: "a", x: 120, y: 300 };
    const previous = trackedState({ nodeLayouts: { a: nodeA, b: nodeB } });
    const current = trackedState({ nodeLayouts: { a: movedA, b: nodeB } });

    const patch = diffPatch(previous, current);

    expect(patch).toEqual({ nodeLayouts: { a: movedA } });
    // The untouched sibling must not ride along — that is the whole point.
    expect(Object.keys(patch!.nodeLayouts as object)).toEqual(["a"]);
  });

  it("leaves untouched collections out of the patch entirely", () => {
    const previous = trackedState({ nodeLayouts: { a: nodeA }, components: { c: { id: "c" } } });
    const current = trackedState({
      nodeLayouts: { a: { elementId: "a", x: 1, y: 1 } },
      components: previous.components,
    });

    const patch = diffPatch(previous, current);

    expect(patch).not.toHaveProperty("components");
    expect(patch).not.toHaveProperty("connections");
  });

  it("still sends scalars whole", () => {
    const previous = trackedState({ diagramName: "Before" });
    const current = trackedState({ diagramName: "After" });

    expect(diffPatch(previous, current)).toEqual({ diagramName: "After" });
  });

  it("diffs several collections independently in one patch", () => {
    const edge = { id: "e1" };
    const previous = trackedState({ nodeLayouts: { a: nodeA }, edgeLayouts: {} });
    const current = trackedState({
      nodeLayouts: { a: nodeA, b: nodeB },
      edgeLayouts: { e1: edge },
    });

    expect(diffPatch(previous, current)).toEqual({
      nodeLayouts: { b: nodeB },
      edgeLayouts: { e1: edge },
    });
  });
});
