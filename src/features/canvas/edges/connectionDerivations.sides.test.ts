import { describe, expect, it } from "vitest";
import type { Component, Connection } from "@/features/diagram";
import {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  handleIdFor,
  resolveEdgeSides,
  type NodeBox,
} from "./connectionDerivations";

const box = (x: number, width = 180): NodeBox => ({ x, y: 0, width, height: 80 });

const component = (id: string, handleOrder?: Component["handleOrder"]): Component =>
  ({
    id,
    name: id,
    description: "",
    parentId: null,
    type: "system",
    ...(handleOrder ? { handleOrder } : {}),
  }) as Component;

const connection = (id: string, sourceId: string, targetId: string): Connection =>
  ({ id, sourceId, targetId, label: "" }) as Connection;

describe("resolveEdgeSides", () => {
  it("keeps the default sides when the target is to the right", () => {
    expect(resolveEdgeSides(box(0), box(400))).toBe("forward");
  });

  it("mirrors when the target is entirely to the left", () => {
    expect(resolveEdgeSides(box(800), box(0))).toBe("mirrored");
  });

  it("keeps the default while the boxes still overlap horizontally", () => {
    // Target starts left of the source but its right edge is past the source's
    // left edge — the dead band that stops a pixel nudge from flipping sides.
    expect(resolveEdgeSides(box(200), box(100))).toBe("forward");
  });

  it("does not flip on a one-pixel move near the boundary", () => {
    const source = box(200);
    // Target's right edge exactly at the source's left edge, then ±1px.
    expect(resolveEdgeSides(source, { x: 20, y: 0, width: 180, height: 80 })).toBe("forward");
    expect(resolveEdgeSides(source, { x: 21, y: 0, width: 180, height: 80 })).toBe("forward");
    expect(resolveEdgeSides(source, { x: 19, y: 0, width: 180, height: 80 })).toBe("mirrored");
    // Flipping back needs a real move, not a jitter: the whole node width.
    expect(resolveEdgeSides(source, { x: 19 + 180, y: 0, width: 180, height: 80 })).toBe("forward");
  });

  it("falls back to the default when geometry is unknown", () => {
    expect(resolveEdgeSides(undefined, box(0))).toBe("forward");
    expect(resolveEdgeSides(box(0), undefined)).toBe("forward");
  });
});

describe("handleIdFor", () => {
  it("keeps the original ids on the default sides", () => {
    expect(handleIdFor("source", "forward", 2)).toBe("source-2");
    expect(handleIdFor("target", "forward", 0)).toBe("target-0");
  });

  it("uses distinct ids for the mirrored sides", () => {
    expect(handleIdFor("source", "mirrored", 1)).toBe("source-l-1");
    expect(handleIdFor("target", "mirrored", 3)).toBe("target-r-3");
  });
});

describe("buildConnectionCountPerNode", () => {
  it("splits counts per side once geometry is known", () => {
    const counts = buildConnectionCountPerNode(
      [connection("c1", "a", "b"), connection("c2", "a", "z")],
      { a: box(400), b: box(800), z: box(0) },
    );
    expect(counts.a).toMatchObject({ outgoing: 2, outgoingRight: 1, outgoingLeft: 1 });
    expect(counts.b).toMatchObject({ incomingLeft: 1, incomingRight: 0 });
    expect(counts.z).toMatchObject({ incomingLeft: 0, incomingRight: 1 });
  });

  it("puts everything on the default side without geometry", () => {
    const counts = buildConnectionCountPerNode([connection("c1", "a", "b")]);
    expect(counts.a).toMatchObject({ outgoing: 1, outgoingRight: 1, outgoingLeft: 0 });
  });
});

describe("buildEdgeHandleAssignments — sides", () => {
  const components = { a: component("a"), b: component("b"), z: component("z") };

  it("assigns mirrored handles to a back-edge", () => {
    const connections = [connection("c1", "a", "b"), connection("c2", "a", "z")];
    const boxes = { a: box(400), b: box(800), z: box(0) };
    const counts = buildConnectionCountPerNode(connections, boxes);

    const [forward, backward] = buildEdgeHandleAssignments(connections, counts, components, boxes);
    expect(forward).toMatchObject({ sourceHandle: "source-0", targetHandle: "target-0" });
    expect(backward).toMatchObject({ sourceHandle: "source-l-0", targetHandle: "target-r-0" });
  });

  it("slots each side independently, so neither side is left with a gap", () => {
    const connections = [
      connection("c1", "a", "b"),
      connection("c2", "a", "z"),
      connection("c3", "a", "b2"),
    ];
    const boxes = { a: box(400), b: box(800), b2: box(1200), z: box(0) };
    const withB2 = { ...components, b2: component("b2") };
    const counts = buildConnectionCountPerNode(connections, boxes);

    const assignments = buildEdgeHandleAssignments(connections, counts, withB2, boxes);
    // Two edges leave right and take slots 0 and 1; the single left edge is 0.
    expect(assignments.map((a) => a.sourceHandle)).toEqual(["source-0", "source-l-0", "source-1"]);
  });

  it("still honours a manual handleOrder", () => {
    const connections = [connection("c1", "a", "b"), connection("c2", "a", "b2")];
    const boxes = { a: box(400), b: box(800), b2: box(1200) };
    const ordered = {
      ...components,
      a: component("a", { incoming: [], outgoing: ["c2", "c1"] }),
      b2: component("b2"),
    };
    const counts = buildConnectionCountPerNode(connections, boxes);

    const assignments = buildEdgeHandleAssignments(connections, counts, ordered, boxes);
    // The user's order wins: c2 first, c1 second.
    expect(assignments.find((a) => a.connId === "c2")?.sourceHandle).toBe("source-0");
    expect(assignments.find((a) => a.connId === "c1")?.sourceHandle).toBe("source-1");
  });

  it("behaves exactly as before when no geometry is supplied", () => {
    const connections = [connection("c1", "a", "b"), connection("c2", "a", "z")];
    const counts = buildConnectionCountPerNode(connections);
    const assignments = buildEdgeHandleAssignments(connections, counts, components);
    expect(assignments.map((a) => a.sourceHandle)).toEqual(["source-0", "source-1"]);
    expect(assignments.map((a) => a.targetHandle)).toEqual(["target-0", "target-0"]);
  });
});
