import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { computeAutoLayout } from "../layout/autoLayoutEngine";
import { useDiagramActions, useDiagramStore } from "@/features/diagram";
import type { Component, Connection, NodeLayout } from "@/features/diagram";

export function useAutoLayout() {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const { applyAutoLayout, updateEdgeWaypoints, clearEdgeWaypoints } = useDiagramActions();
  const [isRunning, setIsRunning] = useState(false);

  const runAutoLayout = useCallback(
    async (
      components: Record<string, Component>,
      connections: Connection[],
      nodeLayouts: Record<string, NodeLayout>,
    ) => {
      if (isRunning) return;
      setIsRunning(true);
      try {
        const result = await computeAutoLayout(components, connections, nodeLayouts);

        if (result.positions.length === 0) {
          toast.info(t("autoLayout.noConnectedNodes"));
          return;
        }

        applyAutoLayout(result.positions);

        const diagramId = useDiagramStore.getState().activeDiagramId;
        if (diagramId !== null) {
          for (const connectionId of result.laidOutConnectionIds) {
            clearEdgeWaypoints(diagramId, connectionId);
          }

          for (const [connectionId, waypoints] of result.edgeWaypoints) {
            if (waypoints.length > 0) {
              updateEdgeWaypoints(diagramId, connectionId, waypoints);
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
    [
      isRunning,
      applyAutoLayout,
      updateEdgeWaypoints,
      clearEdgeWaypoints,
      fitView,
      t,
    ],
  );

  return { runAutoLayout, isRunning };
}
