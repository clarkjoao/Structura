import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { CompareElementVisual, Component, Diagram } from "@/features/diagram";
import "@/features/canvas/nodes/node-types/registry";
import { buildReadNodeContext } from "../core/buildReadNodeContext";
import { writePolicy } from "../core/canvasInteractionPolicy";
import { projectNodes } from "../core/projectDiagram";
import { resolveViewSnapshot, type ViewNode } from "../core/resolveViewSnapshot";
import {
  OPACITY_FLOW_PLAYBACK_NODE_DIM,
  OPACITY_TAG_FILTER_DIM,
  OPACITY_TAG_FILTER_TRANSITION,
} from "../constants/opacity";
import type { CoverageInfo } from "../flow/flowState";
import { resolveNodeDescriptor } from "./node-types";
import {
  applyEditorNodeOverlays,
  compareOverlay,
  coverageDimOverlay,
  focusDimOverlay,
  lockOverlay,
  pendingOverlay,
  readingOverlay,
  versionLockOverlay,
  selectedOverlay,
  tagFilterOverlay,
  type EditorNodeOverlayInput,
} from "./nodeOverlays";

/**
 * Each editor overlay on its own, over what `projectNodes` actually produces.
 *
 * The contract every overlay keeps (slice 5 of
 * docs/investigation/divergencia-edicao-visualizacao.md): it may add to the
 * style, add a class, turn an interaction off or mark the node selected, and
 * it may not move, resize, restack, re-nest, hide or rewrite the node. When it
 * does not apply it hands back the very same object.
 */

const component = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, ...partial }) as unknown as Component;

function projected(): { node: Node; viewNode: ViewNode } {
  const diagram = {
    id: "overlays",
    name: "Overlays",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: {
        P: component({ id: "P", name: "P", type: "panel", panelKind: "default" }),
        a: component({ id: "a", name: "a", type: "system", parentId: "P" }),
        b: component({ id: "b", name: "b", type: "system" }),
      },
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      P: { elementId: "P", x: 0, y: 0, width: 400, height: 300, zIndex: -1 },
      a: { elementId: "a", x: 20, y: 60 },
      b: { elementId: "b", x: 600, y: 40, zIndex: 3 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
  const view = resolveViewSnapshot(diagram, { versionId: null }, resolveNodeDescriptor);
  const ctx = buildReadNodeContext(diagram, view.components, view.nodeLayouts, [], null, undefined);
  const nodes = projectNodes(view, ctx, writePolicy(true), resolveNodeDescriptor);
  const index = view.nodes.findIndex((n) => n.component.id === "b");
  return { node: nodes[index]!, viewNode: view.nodes[index]! };
}

/** Everything an overlay must leave alone. */
function drawn(node: Node) {
  const style = (node.style ?? {}) as { width?: unknown; height?: unknown };
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    zIndex: node.zIndex,
    parentId: node.parentId,
    extent: node.extent,
    hidden: node.hidden,
    data: node.data,
    width: style.width,
    height: style.height,
    dragHandle: node.dragHandle,
  };
}

const coverageWith = (walked: string[]): CoverageInfo =>
  ({
    nodeFlows: new Map(walked.map((id) => [id, ["f"]])),
    edgeFlows: new Map(),
  }) as unknown as CoverageInfo;

const visual = (opacity: number, badges: "both" | "a" | "b"): CompareElementVisual =>
  ({
    opacity,
    ...(badges !== "b" ? { badgeA: { name: "A", color: "#f00" } } : {}),
    ...(badges !== "a" ? { badgeB: { name: "B", color: "#0f0" } } : {}),
  }) as CompareElementVisual;

describe("each node overlay, applied alone", () => {
  const { node, viewNode } = projected();
  const others = new Set(["a"]);

  const cases: {
    name: string;
    apply: (n: Node) => Node;
    expectOn: (n: Node) => void;
    off: (n: Node) => Node;
  }[] = [
    {
      name: "selected",
      apply: (n) => selectedOverlay(n, viewNode, new Set(["b"])),
      expectOn: (n) => expect(n.selected).toBe(true),
      off: (n) => selectedOverlay(n, viewNode, others),
    },
    {
      name: "focus dim",
      apply: (n) => focusDimOverlay(n, viewNode, others, new Set(), false),
      expectOn: (n) => expect(n.style?.opacity).toBe(OPACITY_FLOW_PLAYBACK_NODE_DIM),
      off: (n) => focusDimOverlay(n, viewNode, others, new Set(), true),
    },
    {
      name: "coverage dim",
      apply: (n) => coverageDimOverlay(n, viewNode, true, coverageWith(["a"]), false),
      expectOn: (n) => expect(n.style?.opacity).toBe(OPACITY_FLOW_PLAYBACK_NODE_DIM),
      off: (n) => coverageDimOverlay(n, viewNode, true, coverageWith(["b"]), false),
    },
    {
      name: "compare",
      apply: (n) => compareOverlay(n, true, visual(0.4, "a")),
      expectOn: (n) => {
        expect(n.style?.opacity).toBeCloseTo(0.4);
        expect(n.className).toBe("cursor-default node-diff-removed");
        expect([n.draggable, n.selectable, n.focusable, n.connectable]).toEqual([
          false,
          false,
          false,
          false,
        ]);
      },
      off: (n) => compareOverlay(n, false, undefined),
    },
    {
      name: "tag filter",
      apply: (n) => tagFilterOverlay(n, true),
      expectOn: (n) => {
        expect(n.style).toMatchObject({
          opacity: OPACITY_TAG_FILTER_DIM,
          pointerEvents: "none",
          transition: OPACITY_TAG_FILTER_TRANSITION,
        });
        expect(n.draggable).toBe(false);
      },
      off: (n) => tagFilterOverlay(n, false),
    },
    {
      name: "reading",
      apply: (n) => readingOverlay(n, true),
      expectOn: (n) =>
        expect([n.draggable, n.selectable, n.focusable, n.connectable]).toEqual([
          false,
          false,
          false,
          false,
        ]),
      off: (n) => readingOverlay(n, false),
    },
    {
      name: "lock",
      apply: (n) => lockOverlay(n, true),
      expectOn: (n) => {
        expect(n.className).toBe("cursor-not-allowed");
        expect(n.draggable).toBe(false);
        expect(n.selectable).toBe(node.selectable);
      },
      off: (n) => lockOverlay(n, false),
    },
    {
      name: "scene lock",
      apply: (n) => versionLockOverlay(n, true),
      expectOn: (n) => {
        expect(n.draggable).toBe(false);
        expect(n.selectable).toBe(node.selectable);
      },
      off: (n) => versionLockOverlay(n, false),
    },
    {
      name: "pending",
      apply: (n) => pendingOverlay(n, true),
      expectOn: (n) => expect(n.className).toBe("node-pending"),
      off: (n) => pendingOverlay(n, false),
    },
  ];

  for (const { name, apply, expectOn, off } of cases) {
    it(`${name}: has its effect and moves nothing`, () => {
      const result = apply(node);
      expectOn(result);
      expect(drawn(result)).toEqual(drawn(node));
    });

    it(`${name}: hands back the same object when it does not apply`, () => {
      expect(off(node)).toBe(node);
    });
  }
});

describe("the one order overlays need", () => {
  const { node, viewNode } = projected();
  const none: EditorNodeOverlayInput = {
    selectedNodeIds: new Set(),
    highlightedNodeIds: new Set(),
    flowModeActive: false,
    isViewingCoverage: false,
    coverage: null,
    isCompareMode: false,
    compareVisual: undefined,
    hiddenByTag: false,
    isReading: false,
    locked: false,
    lockedByVersion: false,
    pending: false,
  };

  it("with nothing on, the editor draws the projection itself", () => {
    expect(applyEditorNodeOverlays(node, viewNode, none)).toBe(node);
  });

  it("compare scales the focus dim, not the other way round", () => {
    const result = applyEditorNodeOverlays(node, viewNode, {
      ...none,
      selectedNodeIds: new Set(["a"]),
      compareVisual: visual(0.4, "both"),
    });
    expect(result.style?.opacity).toBeCloseTo(OPACITY_FLOW_PLAYBACK_NODE_DIM * 0.4);
  });

  it("the tag filter has the last word on opacity", () => {
    const result = applyEditorNodeOverlays(node, viewNode, {
      ...none,
      selectedNodeIds: new Set(["a"]),
      compareVisual: visual(0.4, "both"),
      hiddenByTag: true,
    });
    expect(result.style?.opacity).toBe(OPACITY_TAG_FILTER_DIM);
  });

  it("classes come out in the order the editor has always written them", () => {
    const result = applyEditorNodeOverlays(node, viewNode, {
      ...none,
      pending: true,
      locked: true,
      isCompareMode: true,
      compareVisual: visual(1, "both"),
    });
    expect(result.className).toBe(
      "cursor-default cursor-not-allowed node-pending node-diff-modified",
    );
    expect(drawn(result)).toEqual(drawn(node));
  });
});
