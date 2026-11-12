import { describe, expect, it } from "vitest";
import { PanOnScrollMode, SelectionMode } from "@xyflow/react";
import { readPolicy, writePolicy } from "./canvasInteractionPolicy";
import {
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  FIT_VIEW_MAX_ZOOM,
  FIT_VIEW_READING_PADDING,
  VIEWPORT_MIN_ZOOM,
} from "../canvas.constants";
import {
  DIAGRAM_EDGE_RF_TYPE,
  MULTI_SELECTION_KEY_CODES,
  PAN_ON_DRAG_MOUSE,
  buildReactFlowShellProps,
} from "./reactFlowBaseConfig";

describe("buildReactFlowShellProps", () => {
  it("locks the graph for read policy and keeps viewer input profile", () => {
    const props = buildReactFlowShellProps(readPolicy());
    expect(props.nodesDraggable).toBe(false);
    expect(props.nodesConnectable).toBe(false);
    expect(props.elementsSelectable).toBe(false);
    expect(props.panOnDrag).toBe(true);
    expect(props.panOnScroll).toBe(true);
    expect(props.panOnScrollMode).toBe(PanOnScrollMode.Free);
    expect(props.zoomOnScroll).toBe(true);
    expect(props.zoomOnPinch).toBe(true);
    expect(props.minZoom).toBe(VIEWPORT_MIN_ZOOM);
    expect(props.maxZoom).toBe(FIT_VIEW_MAX_ZOOM);
    expect(props.fitViewOptions.padding).toBe(FIT_VIEW_READING_PADDING);
  });

  it("gates write interactivity from graphInteractive", () => {
    const locked = buildReactFlowShellProps(writePolicy(false));
    expect(locked.nodesDraggable).toBe(false);
    expect(locked.elementsSelectable).toBe(false);

    const open = buildReactFlowShellProps(writePolicy(true), {
      inputProfile: {
        isTouchDevice: false,
        isCoarsePointer: false,
        prefersTouchCanvasUi: false,
      },
    });
    expect(open.nodesDraggable).toBe(true);
    expect(open.panOnDrag).toEqual(PAN_ON_DRAG_MOUSE);
    expect(open.panOnScroll).toBe(false);
    expect(open.zoomOnScroll).toBe(false);
    expect(open.selectionMode).toBe(SelectionMode.Partial);
    expect(open.multiSelectionKeyCode).toEqual(MULTI_SELECTION_KEY_CODES);
    expect(open.minZoom).toBe(CANVAS_MIN_ZOOM);
    expect(open.maxZoom).toBe(CANVAS_MAX_ZOOM);
  });

  it("hands React Flow the same fitViewOptions object on every render (audit R8)", () => {
    // React Flow writes the prop into the store slot where a pending `fitView(options)` waits
    // for the nodes to be measured; a new object per render overwrote those options.
    for (const policy of [readPolicy(), writePolicy(true)]) {
      expect(buildReactFlowShellProps(policy).fitViewOptions).toBe(
        buildReactFlowShellProps(policy).fitViewOptions,
      );
    }
  });

  it("uses a single edge RF type key", () => {
    expect(DIAGRAM_EDGE_RF_TYPE).toBe("editable");
  });
});
