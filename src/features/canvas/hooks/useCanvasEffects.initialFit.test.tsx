import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { ReactFlowProvider, type ReactFlowInstance } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagramStore, type Diagram } from "@/features/diagram";
import {
  FIT_VIEW_INITIAL_PADDING,
  FIT_VIEW_MAX_ZOOM,
  VIEWPORT_MIN_ZOOM,
} from "../canvas.constants";
import { useCanvasEffects } from "./useCanvasEffects";

const DIAGRAM_ID = "initial-fit-diagram";

function instance() {
  return {
    fitView: vi.fn(() => Promise.resolve(true)),
    setViewport: vi.fn(() => Promise.resolve(true)),
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  };
}

function open(viewport: { x: number; y: number; zoom: number } | undefined) {
  const diagram = { id: DIAGRAM_ID, viewport } as Diagram;
  useDiagramStore.setState((state) => ({
    diagrams: { ...state.diagrams, [DIAGRAM_ID]: diagram },
  }));
  const flow = instance();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ReactFlowProvider>{children}</ReactFlowProvider>
  );
  renderHook(
    () =>
      useCanvasEffects({
        diagram,
        reactFlowInstance: flow as unknown as ReactFlowInstance,
        isPlaying: false,
        onClearSelection: () => {},
      }),
    { wrapper },
  );
  return flow;
}

/**
 * Audit R8: the opening zoom of a diagram with no saved viewport alternated run
 * to run (0.133 / 0.30 at 400 nodes) because two fits raced — React Flow's own
 * (`fitView` prop, its default min zoom) and this hook's (the product's padding
 * and zoom bounds). This hook is now the only one.
 */
describe("useCanvasEffects: the initial fit", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    useDiagramStore.setState((state) => {
      const diagrams = { ...state.diagrams };
      delete diagrams[DIAGRAM_ID];
      return { diagrams };
    });
  });

  it("fits once, with the product's padding and zoom bounds, when nothing was saved", () => {
    const flow = open({ x: 0, y: 0, zoom: 1 });
    expect(flow.fitView).toHaveBeenCalledTimes(1);
    expect(flow.fitView).toHaveBeenCalledWith({
      padding: FIT_VIEW_INITIAL_PADDING,
      minZoom: VIEWPORT_MIN_ZOOM,
      maxZoom: FIT_VIEW_MAX_ZOOM,
      duration: 0,
    });
    expect(flow.setViewport).not.toHaveBeenCalled();
  });

  it("restores a saved viewport instead of fitting", () => {
    const flow = open({ x: 120, y: -40, zoom: 0.8 });
    expect(flow.setViewport).toHaveBeenCalledWith({ x: 120, y: -40, zoom: 0.8 }, { duration: 0 });
    expect(flow.fitView).not.toHaveBeenCalled();
  });

  it("is the only owner: the editor does not also ask React Flow to fit", () => {
    const canvas = fs.readFileSync(path.join(__dirname, "..", "Canvas.tsx"), "utf8");
    expect(canvas).not.toMatch(/\bfitView[=\s{]/);
  });
});
