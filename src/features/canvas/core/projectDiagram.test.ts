import { describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { Component, Diagram } from "@/features/diagram";
import "@/features/canvas/nodes/node-types/registry";
import { resolveNodeDescriptor } from "../nodes/node-types";
import { buildReadNodeContext } from "./buildReadNodeContext";
import { readPolicy, writePolicy } from "./canvasInteractionPolicy";
import { projectNodes } from "./projectDiagram";
import { resolveViewSnapshot } from "./resolveViewSnapshot";

/**
 * The read policy locks a node — its interaction flags and its editing
 * controls — inside the projection, and the write policy leaves the same node
 * alone. Before slice 7 of docs/investigation/divergencia-edicao-visualizacao.md
 * the controls were locked by a separate `lockForReading` the viewer ran after
 * projecting.
 */

const component = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, ...partial }) as unknown as Component;

function project(policy: ReturnType<typeof readPolicy>): {
  nodes: Record<string, Node>;
  onPlayFlow: (flowId: string) => void;
} {
  const diagram = {
    id: "lock",
    name: "Lock",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: {
        note: component({ id: "note", name: "note", type: "note", content: "hello" }),
        card: component({ id: "card", name: "card", type: "system" }),
        route: component({ id: "route", name: "route", type: "endpoint", method: "GET" }),
      },
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      note: { elementId: "note", x: 0, y: 0 },
      card: { elementId: "card", x: 300, y: 0 },
      route: { elementId: "route", x: 600, y: 0 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
  const view = resolveViewSnapshot(diagram, { sceneId: null }, resolveNodeDescriptor);
  const onPlayFlow = vi.fn();
  // The same context for both policies, with an editing callback in it — so
  // any difference below is the policy's.
  const ctx = {
    ...buildReadNodeContext(diagram, view.components, view.nodeLayouts, [], null, onPlayFlow),
    setNoteInlineEditingId: vi.fn(),
  };
  const nodes = projectNodes(view, ctx, policy, resolveNodeDescriptor);
  return { nodes: Object.fromEntries(nodes.map((node) => [node.id, node])), onPlayFlow };
}

const LOCKED_CALLBACKS = [
  "onDrillDown",
  "onEmbed",
  "onReorderHandle",
  "onAddEndpoint",
  "onOpenInCanvas",
  "onInlineEditingChange",
] as const;

describe("the read policy locks nodes inside the projection", () => {
  it("turns every interaction off and every editing control off", () => {
    const { nodes } = project(readPolicy());
    for (const node of Object.values(nodes)) {
      expect([node.draggable, node.selectable, node.connectable]).toEqual([false, false, false]);
      expect(node.data.controlsDisabled).toBe(true);
      for (const key of LOCKED_CALLBACKS) expect(node.data[key]).toBeUndefined();
    }
  });

  it("keeps a reader's way into a flow: the play control's callback survives the lock", () => {
    // What `.flow-play-control` (EndpointNode, ApiGroupNode) calls on click.
    const { nodes, onPlayFlow } = project(readPolicy());
    expect(nodes.route!.data.onPlayFlow).toBe(onPlayFlow);
  });

  it("leaves the editor's node alone", () => {
    const { nodes } = project(writePolicy(true));
    expect(nodes.note!.data.controlsDisabled).toBeUndefined();
    expect(typeof nodes.note!.data.onInlineEditingChange).toBe("function");
    expect(nodes.note!.draggable).not.toBe(false);
    expect(nodes.card!.selectable).not.toBe(false);
  });

  it("the lock is the policy's, not the context's: the same context unlocks under write", () => {
    const read = project(readPolicy()).nodes;
    const write = project(writePolicy(true)).nodes;
    expect(read.note!.data.onInlineEditingChange).toBeUndefined();
    expect(write.note!.data.onInlineEditingChange).toBeDefined();
  });
});
