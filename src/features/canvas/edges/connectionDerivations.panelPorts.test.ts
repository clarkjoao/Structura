import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";
import type { Component, Connection } from "@/features/diagram";
import { buildConnectionCountPerNode, buildEdgeHandleAssignments } from "./connectionDerivations";
import { buildPanelHandles, handleSlotCount, handleTopPercent } from "../nodes/CustomNode/Handles";
import { handleAnchor } from "../layout/renderedEdgePath";

/**
 * Port ordering on a panel.
 *
 * An edge addressed to a container is now drawn, so ELK's port ordering has to
 * reach the panel the same way it reaches a leaf — otherwise the container edges
 * arrive on the canvas in connection order, which is uncorrelated with where the
 * other end sits, and the whole 48 -> 15 crossing improvement stops applying to
 * exactly the edges this slice made visible.
 *
 * Nothing in `buildEdgeHandleAssignments` special-cases a component type when it
 * reads `handleOrder`, and these tests are what keeps it that way.
 */

const panel = (id: string, handleOrder?: Component["handleOrder"]): Component =>
  ({
    id,
    name: id,
    description: "",
    parentId: null,
    type: "panel",
    panelKind: "generic",
    ...(handleOrder ? { handleOrder } : {}),
  }) as unknown as Component;

const leaf = (id: string): Component =>
  ({ id, name: id, description: "", parentId: null, type: "system" }) as Component;

const connection = (id: string, sourceId: string, targetId: string): Connection =>
  ({ id, sourceId, targetId, label: "" }) as Connection;

const assign = (connections: Connection[], components: Record<string, Component>) =>
  buildEdgeHandleAssignments(connections, buildConnectionCountPerNode(connections), components);

describe("a panel honours its stored handle order", () => {
  // Three sources into one panel. Insertion order is c1, c2, c3; the stored
  // order is the reverse, so round-robin and `handleOrder` disagree on every
  // slot. A test where the two agree proves nothing.
  const connections = [
    connection("c1", "a", "vpc"),
    connection("c2", "b", "vpc"),
    connection("c3", "c", "vpc"),
  ];
  const stored = { incoming: ["c3", "c2", "c1"], outgoing: [] };

  it("assigns the slot the order names, not the arrival order", () => {
    const components = {
      a: leaf("a"),
      b: leaf("b"),
      c: leaf("c"),
      vpc: panel("vpc", stored),
    };

    const slots = Object.fromEntries(
      assign(connections, components).map((a) => [a.connId, a.targetHandle]),
    );

    expect(slots).toEqual({ c1: "target-2", c2: "target-1", c3: "target-0" });
  });

  it("differs from what the same panel gets with no stored order", () => {
    // The control: without `handleOrder` the slots come out in arrival order.
    // If this matched the assertion above, the test above would be measuring
    // nothing.
    const components = { a: leaf("a"), b: leaf("b"), c: leaf("c"), vpc: panel("vpc") };

    const slots = Object.fromEntries(
      assign(connections, components).map((a) => [a.connId, a.targetHandle]),
    );

    expect(slots).toEqual({ c1: "target-0", c2: "target-1", c3: "target-2" });
  });

  it("orders a panel's outgoing side too", () => {
    const outgoing = [
      connection("o1", "vpc", "a"),
      connection("o2", "vpc", "b"),
      connection("o3", "vpc", "c"),
    ];
    const components = {
      a: leaf("a"),
      b: leaf("b"),
      c: leaf("c"),
      vpc: panel("vpc", { incoming: [], outgoing: ["o2", "o3", "o1"] }),
    };

    const slots = Object.fromEntries(
      assign(outgoing, components).map((a) => [a.connId, a.sourceHandle]),
    );

    expect(slots).toEqual({ o2: "source-0", o3: "source-1", o1: "source-2" });
  });
});

describe("a panel renders the slot the assignment reaches for", () => {
  it.each([1, 2, 3, 4, 7])("renders %i incoming slots as target-0..n", (count) => {
    const handles = buildPanelHandles(count, "target", Position.Left, "vpc");
    const ids = handles.map((h) => (h as { props: { id: string } }).props.id);

    expect(ids).toEqual(Array.from({ length: handleSlotCount(count) }, (_, i) => `target-${i}`));
  });

  it("clamps the same way the assignment clamps", () => {
    // `buildEdgeHandleAssignments` clamps its slot to MAX_HANDLES. A panel that
    // rendered fewer would be React Flow error #008 and a dropped edge; one that
    // rendered more would be dead DOM.
    const many = Array.from({ length: 9 }, (_, i) => connection(`c${i}`, `s${i}`, "vpc"));
    const components: Record<string, Component> = { vpc: panel("vpc") };
    for (let i = 0; i < 9; i += 1) components[`s${i}`] = leaf(`s${i}`);

    const assigned = new Set(assign(many, components).map((a) => a.targetHandle));
    const rendered = new Set(
      buildPanelHandles(9, "target", Position.Left, "vpc").map(
        (h) => (h as { props: { id: string } }).props.id,
      ),
    );

    for (const handle of assigned) {
      expect(rendered, `assignment reached for ${handle}`).toContain(handle);
    }
  });

  it("places a slot where the measurement expects to find it", () => {
    // `handleAnchor` is what `measureRenderedReadability` uses. If the rendered
    // percentage and the measured fraction drift apart, every crossing number in
    // `generated-diagrams.baseline.test.ts` becomes a number about a picture the
    // canvas is not drawing.
    const box = { x: 0, y: 0, width: 300, height: 200 };
    for (const count of [1, 2, 3, 4]) {
      for (let slot = 0; slot < count; slot += 1) {
        const anchor = handleAnchor(box, "target", slot, count);
        expect(anchor.y).toBeCloseTo((box.height * handleTopPercent(slot, count)) / 100, 6);
      }
    }
  });
});
