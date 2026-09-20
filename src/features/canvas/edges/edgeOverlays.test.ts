import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import type { Component, Connection, Diagram } from "@/features/diagram";
import { writePolicy } from "../core/canvasInteractionPolicy";
import { projectEdges } from "../core/projectDiagram";
import { resolveViewSnapshot } from "../core/resolveViewSnapshot";
import { OPACITY_TAG_FILTER_EDGE_DIM, OPACITY_TAG_FILTER_TRANSITION } from "../constants/opacity";
import { EMPTY_FLOW_HIGHLIGHT } from "../flow/flowState";
import { resolveNodeDescriptor } from "../nodes/node-types";
import {
  applyEditorEdgeOverlays,
  compareEdgeOverlay,
  pendingEdgeOverlay,
  selectedEdgeOverlay,
  tagFilterEdgeOverlay,
  type EditorEdgeOverlayInput,
} from "./edgeOverlays";

/**
 * Each editor edge overlay on its own, over what `projectEdges` produces. An
 * overlay may add to the style, add a class or mark the edge selected; the
 * route (data), the ends, the handles and the markers are the projection's.
 */

function projectedEdge(): Edge {
  const component = (id: string): Component =>
    ({ id, name: id, type: "system", description: "", parentId: null }) as unknown as Component;
  const connection = {
    id: "e",
    sourceId: "a",
    targetId: "b",
    label: "calls",
    style: { color: "#123456" },
  } as unknown as Connection;
  const diagram = {
    id: "edge-overlays",
    name: "Edge overlays",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: { a: component("a"), b: component("b") },
      connections: { e: connection },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: { a: { elementId: "a", x: 0, y: 0 }, b: { elementId: "b", x: 400, y: 0 } },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
  const view = resolveViewSnapshot(diagram, { versionId: null }, resolveNodeDescriptor);
  return projectEdges(
    view,
    {
      diagram,
      isPlaying: false,
      isRecording: false,
      activeStep: null,
      flowHighlight: EMPTY_FLOW_HIGHLIGHT,
      flowBadges: null,
      coverage: null,
    },
    writePolicy(true),
    [{ connId: "e", sourceHandle: "source-0", targetHandle: "target-0" }],
  )[0]!;
}

function route(edge: Edge) {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type,
    data: edge.data,
    markerEnd: edge.markerEnd,
    markerStart: edge.markerStart,
    animated: edge.animated,
  };
}

describe("each edge overlay, applied alone", () => {
  const edge = projectedEdge();

  const cases: {
    name: string;
    apply: (e: Edge) => Edge;
    expectOn: (e: Edge) => void;
    off: (e: Edge) => Edge;
  }[] = [
    {
      name: "selected",
      apply: (e) => selectedEdgeOverlay(e, "e"),
      expectOn: (e) => expect(e.selected).toBe(true),
      off: (e) => selectedEdgeOverlay(e, "other"),
    },
    {
      name: "compare",
      apply: (e) => compareEdgeOverlay(e, true, { e: 0.25 }),
      // The stroke colour the projection set is kept; only the opacity is added.
      expectOn: (e) => expect(e.style).toEqual({ stroke: "#123456", opacity: 0.25 }),
      off: (e) => compareEdgeOverlay(e, true, { other: 0.25 }),
    },
    {
      name: "tag filter",
      apply: (e) => tagFilterEdgeOverlay(e, true),
      expectOn: (e) =>
        expect(e.style).toEqual({
          opacity: OPACITY_TAG_FILTER_EDGE_DIM,
          pointerEvents: "none",
          transition: OPACITY_TAG_FILTER_TRANSITION,
        }),
      off: (e) => tagFilterEdgeOverlay(e, false),
    },
    {
      name: "pending",
      apply: (e) => pendingEdgeOverlay(e, true),
      expectOn: (e) => expect(e.className).toBe("edge-pending"),
      off: (e) => pendingEdgeOverlay(e, false),
    },
  ];

  for (const { name, apply, expectOn, off } of cases) {
    it(`${name}: has its effect and leaves the route alone`, () => {
      const result = apply(edge);
      expectOn(result);
      expect(route(result)).toEqual(route(edge));
    });

    it(`${name}: hands back the same object when it does not apply`, () => {
      expect(off(edge)).toBe(edge);
    });
  }
});

describe("edge overlays in order", () => {
  const edge = projectedEdge();
  const none: EditorEdgeOverlayInput = {
    selectedEdgeId: null,
    isCompareMode: false,
    compareConnectionOpacity: undefined,
    dimmedByTag: false,
    pending: false,
  };

  it("with nothing on, the editor draws the projection itself", () => {
    expect(applyEditorEdgeOverlays(edge, none)).toBe(edge);
  });

  it("the tag filter replaces the style compare mode set", () => {
    const result = applyEditorEdgeOverlays(edge, {
      ...none,
      isCompareMode: true,
      compareConnectionOpacity: { e: 0.25 },
      dimmedByTag: true,
    });
    expect(result.style?.opacity).toBe(OPACITY_TAG_FILTER_EDGE_DIM);
    expect(route(result)).toEqual(route(edge));
  });
});
