import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow, useStoreApi } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { measuredSizesOf } from "../layout/applyLayout";
import { applyDiagramAutoLayout, planDiagramAutoLayout } from "../layout/autoLayoutDiagram";
import { startLayoutTransition } from "../layout/layoutTransition";
import { placeIncrementally } from "../layout/incrementalPlacement";
import { effectiveLayoutGaps } from "../layout/layoutEngine";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils/snapshot-cache";
import { useDiagramActions, useDiagramStore } from "@/features/diagram";
import type { Component, Connection, DiagramLayoutSettings, NodeLayout } from "@/features/diagram";
import type { Node } from "@xyflow/react";

export interface AutoLayoutRunOptions {
  /**
   * Arrange with these settings instead of the diagram's, and store them in the
   * same undo step — what a change in the Arrange menu does.
   */
  settings?: DiagramLayoutSettings;
}

export function useAutoLayout() {
  const { t } = useTranslation();
  const { fitView, getNodes } = useReactFlow();
  const reactFlowStore = useStoreApi();
  const { applyAutoLayout } = useDiagramActions();
  const [isRunning, setIsRunning] = useState(false);
  const endTransitionRef = useRef<() => void>();

  useEffect(() => () => endTransitionRef.current?.(), []);

  // Keep a ref to the latest runAutoLayout for recursive calls
  const runAutoLayoutRef =
    useRef<
      (
        components: Record<string, Component>,
        connections: Connection[],
        nodeLayouts: Record<string, NodeLayout>,
        measuredNodes?: Node[],
        options?: AutoLayoutRunOptions,
      ) => Promise<void>
    >();

  const runAutoLayout = useCallback(
    async (
      components: Record<string, Component>,
      connections: Connection[],
      nodeLayouts: Record<string, NodeLayout>,
      measuredNodes?: Node[],
      options: AutoLayoutRunOptions = {},
    ) => {
      if (isRunning) return;

      // Use provided measured nodes or get fresh nodes from React Flow
      const nodesToUse = measuredNodes ?? getNodes();

      // Check if nodes have measured dimensions; if not, wait for them
      const hasMeasuredDimensions = nodesToUse.some(
        (n) => n.measured?.width !== undefined && n.measured?.height !== undefined,
      );

      if (!hasMeasuredDimensions) {
        // Retry after a short delay to allow nodes to measure
        requestAnimationFrame(() => {
          runAutoLayoutRef.current?.(components, connections, nodeLayouts, getNodes(), options);
        });
        return;
      }

      setIsRunning(true);
      try {
        const store = useDiagramStore.getState();
        const active = store.activeDiagramId ? store.diagrams[store.activeDiagramId] : undefined;
        // A scene adds and removes elements through its own diff; references are
        // made on the base diagram only, and a scene is laid out as it is.
        const inScene = !!active?.activeVersionId && !!active.versions?.[active.activeVersionId];
        const writeSettings = options.settings !== undefined;
        const settings = writeSettings ? options.settings : active?.layoutSettings;
        // The same plan the assistant and generation run (`autoLayoutDiagram.ts`),
        // with the sizes React Flow measured.
        const plan = await planDiagramAutoLayout({
          components,
          connections,
          nodeLayouts,
          measured: measuredSizesOf(nodesToUse),
          autoRefs: !inScene,
          ...(settings ? { settings } : {}),
        });
        const { groups } = plan;

        if (plan.result.boxes.size === 0) {
          toast.info(t("autoLayout.nothingToLayout"));
          return;
        }

        endTransitionRef.current = startLayoutTransition(reactFlowStore.getState().domNode);
        const diagramId = useDiagramStore.getState().activeDiagramId;
        if (diagramId !== null) applyDiagramAutoLayout(plan, diagramId, { writeSettings });
        else applyAutoLayout(plan.layouts, plan.autoRefs);

        requestAnimationFrame(() => {
          fitView({ duration: 400, padding: 0.2 });
        });
        toast.success(
          groups.length > 0
            ? t("autoLayout.appliedWithRefs", { count: groups.length })
            : t("autoLayout.applied"),
        );
      } catch (err) {
        console.error("[autoLayout] ELK error", err);
        toast.error(t("autoLayout.error"));
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, applyAutoLayout, fitView, getNodes, reactFlowStore, t],
  );

  // Keep ref in sync with the callback
  useEffect(() => {
    runAutoLayoutRef.current = runAutoLayout;
  }, [runAutoLayout]);

  /**
   * The automatic mode's run: places only `dirtyIds` next to what they connect
   * to (`placeIncrementally`) and leaves the rest of the diagram alone. It joins
   * the undo step of the edit that caused it, keeps the viewport, and says
   * nothing.
   */
  const placeTouched = useCallback(
    (dirtyIds: readonly string[], labelled: boolean) => {
      const state = useDiagramStore.getState();
      const diagram = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
      if (!diagram) return;
      const resolved = getCachedCanvasSnapshot(diagram);
      const gaps = effectiveLayoutGaps(diagram.layoutSettings, labelled);
      const placements = placeIncrementally({
        components: resolved.components,
        connections: resolved.connections,
        nodeLayouts: resolved.nodeLayouts,
        measured: measuredSizesOf(getNodes()),
        dirtyIds,
        columnGap: gaps.layerGap,
        rowGap: Math.round(gaps.nodeGap / 2),
      });
      if (placements.length === 0) return;

      endTransitionRef.current = startLayoutTransition(reactFlowStore.getState().domNode);
      state.applyAutoLayout(placements, undefined, { history: false });
      // A placed element's stored routes were drawn for where it was.
      const placedIds = new Set(placements.map((placement) => placement.elementId));
      for (const connection of Object.values(resolved.connections)) {
        if (placedIds.has(connection.sourceId) || placedIds.has(connection.targetId)) {
          state.resetEdgeControlPoints(diagram.id, connection.id, { history: false });
        }
      }
    },
    [getNodes, reactFlowStore],
  );

  return { runAutoLayout, placeTouched, isRunning };
}
