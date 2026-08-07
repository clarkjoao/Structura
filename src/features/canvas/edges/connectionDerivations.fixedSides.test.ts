import { describe, expect, it } from "vitest";
import type { Component, Connection } from "@/features/diagram";
import { buildConnectionCountPerNode, buildEdgeHandleAssignments } from "./connectionDerivations";

/**
 * Structura's reading direction is enforced by the handles: left is input only,
 * right is output only, on every node, whatever its position. These tests exist
 * because that rule was once broken by deriving the side from the node boxes —
 * moving a node then rewired the edges already on the canvas.
 *
 * The guard is the signature as much as the assertions: no geometry goes in, so
 * no geometry can come out. Nothing in this module may take node positions.
 */

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

const assign = (connections: Connection[], components: Record<string, Component>) =>
  buildEdgeHandleAssignments(connections, buildConnectionCountPerNode(connections), components);

describe("handle sides are fixed", () => {
  const components = { a: component("a"), b: component("b"), c: component("c") };

  it("leaves the source on the right and arrives on the left", () => {
    const [only] = assign([connection("c1", "a", "b")], components);
    expect(only).toMatchObject({ sourceHandle: "source-0", targetHandle: "target-0" });
  });

  it("uses the same sides for a back-edge as for a forward one", () => {
    // b -> a is the case a geometry-derived rule would mirror. A loop has to
    // keep reading as a loop: out of the right, into the left, both ways.
    const assignments = assign(
      [connection("c1", "a", "b"), connection("c2", "b", "a")],
      components,
    );

    expect(assignments).toMatchObject([
      { connId: "c1", sourceHandle: "source-0", targetHandle: "target-0" },
      { connId: "c2", sourceHandle: "source-0", targetHandle: "target-0" },
    ]);
  });

  it("never emits a mirrored handle id", () => {
    const assignments = assign(
      [
        connection("c1", "a", "b"),
        connection("c2", "b", "c"),
        connection("c3", "c", "a"),
        connection("c4", "b", "a"),
      ],
      components,
    );

    for (const a of assignments) {
      expect(a.sourceHandle).toMatch(/^source-\d+$/);
      expect(a.targetHandle).toMatch(/^target-\d+$/);
    }
  });

  it("counts every edge on one side per node", () => {
    const counts = buildConnectionCountPerNode([
      connection("c1", "a", "b"),
      connection("c2", "a", "c"),
      connection("c3", "b", "a"),
    ]);

    // Two out of a's right and one into its left — not split across four sides.
    expect(counts.a).toEqual({ incoming: 1, outgoing: 2 });
    expect(counts.b).toEqual({ incoming: 1, outgoing: 1 });
  });

  it("varies only the slot, and still honours a manual handleOrder", () => {
    const connections = [connection("c1", "a", "b"), connection("c2", "a", "c")];
    const ordered = { ...components, a: component("a", { incoming: [], outgoing: ["c2", "c1"] }) };

    const assignments = assign(connections, ordered);
    expect(assignments.find((a) => a.connId === "c2")?.sourceHandle).toBe("source-0");
    expect(assignments.find((a) => a.connId === "c1")?.sourceHandle).toBe("source-1");
  });
});
