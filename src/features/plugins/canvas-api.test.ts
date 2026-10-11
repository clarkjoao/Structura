import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { useCanvasSelectionStore } from "@/features/canvas/hooks/useCanvasSelectionStore";
import { useHighlightRequests } from "@/features/canvas/focus/highlightRequests";
import type { PluginManifest } from "./plugin.types";
import {
  createContributionTracker,
  createScopedPluginApi,
  rollbackContributions,
} from "./plugin-api";

const manifest: PluginManifest = {
  id: "structura-plugin-canvas-api-test",
  name: "Canvas API test",
  version: "1.0.0",
  author: "Tests",
  description: "Tests the v1.11 canvas API",
  apiVersion: "^1.11",
  capabilities: ["diagram:read"],
};

afterEach(() => useCanvasSelectionStore.getState().clearSelection());

describe("v1.11 canvas API", () => {
  it("reads the selection and tells of each change, until unsubscribed or rolled back", () => {
    const tracker = createContributionTracker();
    const api = createScopedPluginApi(manifest, tracker, new InMemoryAdapter());
    const listener = vi.fn();
    api.canvas.onSelectionChange(listener);

    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a", "b"]));
    expect(api.canvas.getSelection()).toEqual({ componentIds: ["a", "b"], connectionId: null });
    expect(listener).toHaveBeenLastCalledWith({ componentIds: ["a", "b"], connectionId: null });
    useCanvasSelectionStore.getState().setSelectedEdgeId("c1");
    expect(listener).toHaveBeenLastCalledWith({ componentIds: ["a", "b"], connectionId: "c1" });

    rollbackContributions(tracker);
    useCanvasSelectionStore.getState().clearSelection();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("asks the canvas to light elements, keeping only string ids", () => {
    const api = createScopedPluginApi(manifest, createContributionTracker(), new InMemoryAdapter());
    const before = useHighlightRequests.getState().request?.token ?? 0;
    api.canvas.highlight({
      componentIds: ["a", 7 as unknown as string],
      connectionIds: ["c1"],
    });
    expect(useHighlightRequests.getState().request).toEqual({
      componentIds: ["a"],
      connectionIds: ["c1"],
      token: before + 1,
    });
  });
});
