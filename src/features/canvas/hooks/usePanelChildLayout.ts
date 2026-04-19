import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { computePanelChildLayout } from "../layout/autoLayoutEngine";
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
  const [isRunning, setIsRunning] = useState(false);

  const runPanelChildLayout = useCallback(
    async (panelId: string) => {
      if (isRunning) return;
      setIsRunning(true);
      try {
        const connections = Object.values(connectionsRecord);
        const result = await computePanelChildLayout(panelId, components, connections, nodeLayouts);
        if (result.length === 0) {
          toast.info(t("autoLayout.noConnectedNodes"));
          return;
        }
        applyAutoLayout(result);
        toast.success(t("autoLayout.panelApplied"));
      } catch (err) {
        console.error("[panelChildLayout] ELK error", err);
        toast.error(t("autoLayout.error"));
      } finally {
        setIsRunning(false);
      }
    },
    [applyAutoLayout, components, connectionsRecord, isRunning, nodeLayouts, t],
  );

  return { runPanelChildLayout, isRunning };
}
