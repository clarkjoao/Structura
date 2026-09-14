import { describe, expect, it } from "vitest";
import type { Component, ComponentType, Connection } from "@/features/diagram";
import { MAX_HANDLES } from "@/features/diagram";
import {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
} from "../../edges/connectionDerivations";
import { NODE_TYPE_REGISTRY, handleSpecForType } from "./registry";
import { singleIncomingTargetHandleId } from "./handle-spec";

/**
 * The handle set of a node type is declared, not emergent.
 *
 * Before this, `buildEdgeHandleAssignments` clamped every slot to
 * `MAX_HANDLES` and special-cased three types by name, while each node
 * component decided on its own how many `<Handle>` elements to render. The two
 * disagreed on six types, and a disagreement is not cosmetic: React Flow
 * refuses to create an edge naming a handle the node never rendered (error
 * #008) and the edge disappears with only a console warning.
 *
 * `NodeTypeDescriptor.handles` is now the single statement of what a type
 * renders, and the assignment reads it. This file holds the two sides together.
 */

function componentOf(id: string, type: string): Component {
  return { id, name: id, type, parentId: null } as unknown as Component;
}

function connectionOf(id: string, sourceId: string, targetId: string): Connection {
  return { id, sourceId, targetId } as unknown as Connection;
}

/** `count` edges into and out of one node of `type`, plus the peers they need. */
function fanOf(type: string, count: number) {
  const components: Record<string, Component> = { hub: componentOf("hub", type) };
  const connections: Connection[] = [];
  for (let i = 0; i < count; i += 1) {
    components[`peer-${i}`] = componentOf(`peer-${i}`, "system");
    connections.push(connectionOf(`out-${i}`, "hub", `peer-${i}`));
    connections.push(connectionOf(`in-${i}`, `peer-${i}`, "hub"));
  }
  return { components, connections };
}

function slotsUsedOn(type: string, count: number): { source: Set<string>; target: Set<string> } {
  const { components, connections } = fanOf(type, count);
  const assignments = buildEdgeHandleAssignments(
    connections,
    buildConnectionCountPerNode(connections),
    components,
  );
  const source = new Set<string>();
  const target = new Set<string>();
  for (const assignment of assignments) {
    const connection = connections.find((c) => c.id === assignment.connId)!;
    if (connection.sourceId === "hub") source.add(assignment.sourceHandle);
    if (connection.targetId === "hub") target.add(assignment.targetHandle);
  }
  return { source, target };
}

describe("declared handle specs", () => {
  it("every registered descriptor declares its handle set", () => {
    for (const descriptor of NODE_TYPE_REGISTRY) {
      expect(descriptor.handles, `${descriptor.rfType} declares no handle set`).toBeDefined();
    }
  });

  it("no declared handle set exceeds MAX_HANDLES", () => {
    for (const descriptor of NODE_TYPE_REGISTRY) {
      const { incoming, outgoing } = descriptor.handles;
      if (incoming !== "shared") {
        expect(incoming, `${descriptor.rfType} incoming`).toBeGreaterThanOrEqual(1);
        expect(incoming, `${descriptor.rfType} incoming`).toBeLessThanOrEqual(MAX_HANDLES);
      }
      expect(outgoing, `${descriptor.rfType} outgoing`).toBeGreaterThanOrEqual(1);
      expect(outgoing, `${descriptor.rfType} outgoing`).toBeLessThanOrEqual(MAX_HANDLES);
    }
  });

  /**
   * The general case: a node with far more connections than slots still only
   * ever gets slots its type declared.
   */
  it("never assigns a slot the type did not declare", () => {
    for (const descriptor of NODE_TYPE_REGISTRY) {
      const type = (
        descriptor.rfType === "swimlane" ? "panel" : descriptor.rfType
      ) as ComponentType;
      const spec = handleSpecForType(type);
      const used = slotsUsedOn(type, MAX_HANDLES + 4);

      for (const handle of used.source) {
        const index = Number(/^source-(\d+)$/.exec(handle)?.[1]);
        expect(index, `${type} used ${handle}`).toBeLessThan(spec.outgoing);
      }
      for (const handle of used.target) {
        if (spec.incoming === "shared") {
          expect(handle, `${type} target`).toBe(singleIncomingTargetHandleId("hub"));
          continue;
        }
        const index = Number(/^target-(\d+)$/.exec(handle)?.[1]);
        expect(index, `${type} used ${handle}`).toBeLessThan(spec.incoming);
      }
    }
  });
});

/**
 * The six types the audit found with a gap between what the assignment could
 * ask for and what the component renders. Each one is named here so a
 * regression says which type broke rather than only that something did.
 */
describe("the six corrected types", () => {
  it.each(["note", "json-viewer", "db-table"])(
    "%s takes every incoming edge on its one shared handle and leaves on source-0",
    (type) => {
      const used = slotsUsedOn(type, 6);
      expect([...used.target]).toEqual([singleIncomingTargetHandleId("hub")]);
      expect([...used.source]).toEqual(["source-0"]);
    },
  );

  it.each(["external-element", "svg", "endpoint"])(
    "%s never asks for a slot past the single pair it renders",
    (type) => {
      const used = slotsUsedOn(type, 6);
      expect([...used.target]).toEqual(["target-0"]);
      expect([...used.source]).toEqual(["source-0"]);
    },
  );
});
