import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { layout } from "../layout/layoutEngine";
import { fromDiagram, resizableIds } from "../layout/fromDiagram";
import { measuredSizesOf, toAppliedLayouts } from "../layout/applyLayout";
import { applyLayoutResultEdges } from "../layout/applyLayoutResult";
import {
  useDiagramActions,
  useDiagramStore,
  useComponents,
  useConnections,
  useResolvedNodeLayouts,
} from "@/features/diagram";

export function usePanelChildLayout() {
  const { t } = useTranslation();
  const { applyAutoLayout } = useDiagramActions();
  const components = useComponents();
  const connectionsRecord = useConnections();
  const nodeLayouts = useResolvedNodeLayouts();
  const { getNodes } = useReactFlow();
  const [isRunning, setIsRunning] = useState(false);

  const runPanelChildLayout = useCallback(
    async (panelId: string) => {
      if (isRunning) return;
      setIsRunning(true);
      try {
        const connections = Object.values(connectionsRecord);
        // The panel goes into the graph with its children, not just around them:
        // that is what lets the layout size it to hold what it puts inside.
        const graph = fromDiagram(components, connections, nodeLayouts, {
          rootIds: [panelId],
          measured: measuredSizesOf(getNodes()),
        });
        if (graph.nodes.length <= 1) {
          toast.info(t("autoLayout.nothingToLayout"));
          return;
        }

        const result = await layout(graph);
        if (result.boxes.size === 0) {
          toast.info(t("autoLayout.nothingToLayout"));
          return;
        }

        // The panel keeps where it sits; only its size comes from the layout.
        const panelLayout = nodeLayouts[panelId];
        const applied = toAppliedLayouts(graph, result, resizableIds(graph, components)).map(
          (entry) =>
            entry.elementId === panelId && panelLayout
              ? { ...entry, x: panelLayout.x, y: panelLayout.y }
              : entry,
        );

        applyAutoLayout(applied);

        // Write handle order and waypoints for the edges that belong to this layout.
        const diagramId = useDiagramStore.getState().activeDiagramId;
        if (diagramId !== null) {
          const panelNodeIds = new Set(graph.nodes.map((n) => n.id));
          const scopedEdges = graph.edges.filter(
            (e) => panelNodeIds.has(e.sourceId) && panelNodeIds.has(e.targetId),
          );
          applyLayoutResultEdges(graph, result, diagramId, {
            edgeIds: new Set(scopedEdges.map((e) => e.id)),
          });
        }

        toast.success(t("autoLayout.panelApplied"));
      } catch (err) {
        console.error("[panelChildLayout] ELK error", err);
        toast.error(t("autoLayout.error"));
      } finally {
        setIsRunning(false);
      }
    },
    [applyAutoLayout, components, connectionsRecord, getNodes, isRunning, nodeLayouts, t],
  );

  return { runPanelChildLayout, isRunning };
}
