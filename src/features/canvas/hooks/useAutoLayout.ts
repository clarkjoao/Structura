import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { layout } from "../layout/layoutEngine";
import { fromDiagram, resizableIds } from "../layout/fromDiagram";
import { toAppliedLayouts, measuredSizesOf } from "../layout/applyLayout";
import { applyLayoutResultEdges } from "../layout/applyLayoutResult";
import { useDiagramActions, useDiagramStore } from "@/features/diagram";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import type { Node } from "@xyflow/react";

export function useAutoLayout() {
  const { t } = useTranslation();
  const { fitView, getNodes } = useReactFlow();
  const { applyAutoLayout } = useDiagramActions();
  const [isRunning, setIsRunning] = useState(false);

  // Keep a ref to the latest runAutoLayout for recursive calls
  const runAutoLayoutRef =
    useRef<
      (
        components: Record<string, Component>,
        connections: Connection[],
        nodeLayouts: Record<string, NodeLayout>,
        measuredNodes?: Node[],
      ) => Promise<void>
    >();

  const runAutoLayout = useCallback(
    async (
      components: Record<string, Component>,
      connections: Connection[],
      nodeLayouts: Record<string, NodeLayout>,
      measuredNodes?: Node[],
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
          runAutoLayoutRef.current?.(components, connections, nodeLayouts, getNodes());
        });
        return;
      }

      setIsRunning(true);
      try {
        const graph = fromDiagram(components, connections, nodeLayouts, {
          measured: measuredSizesOf(nodesToUse),
        });
        const result = await layout(graph);

        if (result.boxes.size === 0) {
          toast.info(t("autoLayout.nothingToLayout"));
          return;
        }

        applyAutoLayout(toAppliedLayouts(graph, result, resizableIds(graph, components)));

        const diagramId = useDiagramStore.getState().activeDiagramId;
        if (diagramId !== null) {
          applyLayoutResultEdges(graph, result, diagramId);
        }

        requestAnimationFrame(() => {
          fitView({ duration: 400, padding: 0.2 });
        });
        toast.success(t("autoLayout.applied"));
      } catch (err) {
        console.error("[autoLayout] ELK error", err);
        toast.error(t("autoLayout.error"));
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, applyAutoLayout, fitView, getNodes, t],
  );

  // Keep ref in sync with the callback
  useEffect(() => {
    runAutoLayoutRef.current = runAutoLayout;
  }, [runAutoLayout]);

  return { runAutoLayout, isRunning };
}
