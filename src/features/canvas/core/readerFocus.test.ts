import { describe, expect, it } from "vitest";
import type { Component, Connection, Diagram } from "@/features/diagram";
import "@/features/canvas/nodes/node-types/registry";
import { OPACITY_FLOW_PLAYBACK_NODE_DIM } from "../constants/opacity";
import { projectReadDiagramView } from "./projectReadDiagram";
import { withReaderFocus } from "./readerFocus";

/**
 * The reader's focus dim: the editor's, on the read projection. With a node
 * focused, or an edge highlighted, what has the focus keeps its opacity and
 * everything else is dimmed.
 */

const component = (id: string): Component =>
  ({ id, name: id, type: "system", description: "", parentId: null }) as unknown as Component;

function diagram(): Diagram {
  const connection: Connection = { id: "e", sourceId: "a", targetId: "b", label: "" };
  return {
    id: "reader-focus",
    name: "Reader focus",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: { a: component("a"), b: component("b"), c: component("c") },
      connections: { e: connection },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      a: { elementId: "a", x: 0, y: 0 },
      b: { elementId: "b", x: 300, y: 0 },
      c: { elementId: "c", x: 600, y: 0 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

const opacityOf = (nodes: { id: string; style?: { opacity?: unknown } }[], id: string) =>
  nodes.find((node) => node.id === id)!.style?.opacity;
const unmeasured = () => undefined;
const none = new Set<string>();

describe("withReaderFocus", () => {
  const { nodes, view } = projectReadDiagramView(diagram());

  it("dims every node but the highlighted edge's ends", () => {
    const focused = withReaderFocus(nodes, view, none, new Set(["a", "b"]), false, unmeasured);
    expect(opacityOf(focused, "a")).toBe(opacityOf(nodes, "a"));
    expect(opacityOf(focused, "b")).toBe(opacityOf(nodes, "b"));
    expect(opacityOf(focused, "c")).toBe(OPACITY_FLOW_PLAYBACK_NODE_DIM);
  });

  it("marks the focused node selected and dims every other", () => {
    const focused = withReaderFocus(nodes, view, new Set(["c"]), none, false, unmeasured);
    expect(focused.find((node) => node.id === "c")!.selected).toBe(true);
    expect(focused.filter((node) => node.selected).map((node) => node.id)).toEqual(["c"]);
    expect(opacityOf(focused, "c")).toBe(opacityOf(nodes, "c"));
    expect(opacityOf(focused, "a")).toBe(OPACITY_FLOW_PLAYBACK_NODE_DIM);
    expect(opacityOf(focused, "b")).toBe(OPACITY_FLOW_PLAYBACK_NODE_DIM);
  });

  it("with nothing highlighted, hands back the projection's nodes", () => {
    const focused = withReaderFocus(nodes, view, none, none, false, unmeasured);
    focused.forEach((node, i) => expect(node).toBe(nodes[i]));
  });

  it("stands down while a flow is being read", () => {
    const focused = withReaderFocus(nodes, view, none, new Set(["a", "b"]), true, unmeasured);
    focused.forEach((node, i) => expect(node).toBe(nodes[i]));
  });

  it("still marks the focused node while a flow is being read, without dimming", () => {
    const focused = withReaderFocus(nodes, view, new Set(["c"]), none, true, unmeasured);
    expect(focused.find((node) => node.id === "c")!.selected).toBe(true);
    for (const id of ["a", "b"]) expect(opacityOf(focused, id)).toBe(opacityOf(nodes, id));
  });

  it("carries the size React Flow measured, dimmed or not", () => {
    const measured = { width: 180, height: 72 };
    const focused = withReaderFocus(nodes, view, none, new Set(["a", "b"]), false, () => measured);
    for (const node of focused) expect(node.measured).toEqual(measured);
    expect(opacityOf(focused, "c")).toBe(OPACITY_FLOW_PLAYBACK_NODE_DIM);
  });
});
