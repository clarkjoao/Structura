import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { computeAutoLayout } from "../layout/autoLayoutEngine";
import { useDiagramActions, useDiagramStore, generateId } from "@/features/diagram";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import type { Node } from "@xyflow/react";

export function useAutoLayout() {
  const { t } = useTranslation();
  const { fitView, getNodes } = useReactFlow();
  const { applyAutoLayout, setEdgeControlPoints, resetEdgeControlPoints } = useDiagramActions();
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
        const result = await computeAutoLayout(components, connections, nodeLayouts, measuredNodes);

        if (result.positions.length === 0) {
          toast.info(t("autoLayout.noConnectedNodes"));
          return;
        }

        applyAutoLayout(result.positions);

        const diagramId = useDiagramStore.getState().activeDiagramId;
        if (diagramId !== null) {
          for (const connectionId of result.laidOutConnectionIds) {
            resetEdgeControlPoints(diagramId, connectionId);
          }

          for (const [connectionId, waypoints] of result.edgeWaypoints) {
            if (waypoints.length > 0) {
              setEdgeControlPoints(
                diagramId,
                connectionId,
                waypoints.map((wp) => ({ id: generateId("cp"), x: wp.x, y: wp.y })),
                { history: false },
              );
            }
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
    [isRunning, applyAutoLayout, setEdgeControlPoints, resetEdgeControlPoints, fitView, getNodes, t],
  );

  return { runAutoLayout, isRunning };
}
