import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { layout } from "../layout/layoutEngine";
import { fromDiagram, resizableIds } from "../layout/fromDiagram";
import { toAppliedLayouts, measuredSizesOf, interiorWaypoints } from "../layout/applyLayout";
import { useDiagramActions, useDiagramStore, generateId } from "@/features/diagram";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import type { Node } from "@xyflow/react";

export function useAutoLayout() {
  const { t } = useTranslation();
  const { fitView, getNodes } = useReactFlow();
  const { applyAutoLayout, updateHandleOrder, setEdgeControlPoints, resetEdgeControlPoints } =
    useDiagramActions();
  const [isRunning, setIsRunning] = useState(false);

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
          runAutoLayout(components, connections, nodeLayouts, getNodes());
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

        // handleOrder is what makes ELK's crossing-minimisation land on the canvas.
        // The user explicitly asked for a layout; giving them round-robin handles after
        // a full reorganisation would undo the legibility gain silently.
        for (const node of graph.nodes) {
          const outgoing = result.handleOrder.outgoing.get(node.id);
          if (outgoing?.length) updateHandleOrder(node.id, "outgoing", outgoing);
          const incoming = result.handleOrder.incoming.get(node.id);
          if (incoming?.length) updateHandleOrder(node.id, "incoming", incoming);
        }

        const diagramId = useDiagramStore.getState().activeDiagramId;
        if (diagramId !== null) {
          for (const edge of graph.edges) {
            resetEdgeControlPoints(diagramId, edge.id);

            const waypoints = interiorWaypoints(result.edgeRoutes.get(edge.id));
            if (waypoints.length === 0) continue;

            setEdgeControlPoints(
              diagramId,
              edge.id,
              waypoints.map((wp) => ({ id: generateId("cp"), x: wp.x, y: wp.y })),
              { history: false },
            );
          }
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
    [
      isRunning,
      applyAutoLayout,
      updateHandleOrder,
      setEdgeControlPoints,
      resetEdgeControlPoints,
      fitView,
      getNodes,
      t,
    ],
  );

  return { runAutoLayout, isRunning };
}
