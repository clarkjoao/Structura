import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { layout } from "../layout/layoutEngine";
import { fromDiagram, resizableIds } from "../layout/fromDiagram";
import { measuredSizesOf, toAppliedLayouts } from "../layout/applyLayout";
import {
  useDiagramActions,
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
        // Its children are positioned relative to it either way.
        const panelLayout = nodeLayouts[panelId];
        const applied = toAppliedLayouts(graph, result, resizableIds(graph, components)).map(
          (entry) =>
            entry.elementId === panelId && panelLayout
              ? { ...entry, x: panelLayout.x, y: panelLayout.y }
              : entry,
        );

        applyAutoLayout(applied);
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
