import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { measuredSizesOf } from "../layout/applyLayout";
import { applyDiagramAutoLayout, planDiagramAutoLayout } from "../layout/autoLayoutDiagram";
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
        const store = useDiagramStore.getState();
        const active = store.activeDiagramId ? store.diagrams[store.activeDiagramId] : undefined;
        // A scene adds and removes elements through its own diff; references are
        // made on the base diagram only, and a scene is laid out as it is.
        const inScene = !!active?.activeVersionId && !!active.versions?.[active.activeVersionId];
        // The same plan the assistant and generation run (`autoLayoutDiagram.ts`),
        // with the sizes React Flow measured.
        const plan = await planDiagramAutoLayout({
          components,
          connections,
          nodeLayouts,
          measured: measuredSizesOf(nodesToUse),
          autoRefs: !inScene,
        });
        const { groups } = plan;

        if (plan.result.boxes.size === 0) {
          toast.info(t("autoLayout.nothingToLayout"));
          return;
        }

        const diagramId = useDiagramStore.getState().activeDiagramId;
        if (diagramId !== null) applyDiagramAutoLayout(plan, diagramId);
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
    [isRunning, applyAutoLayout, fitView, getNodes, t],
  );

  // Keep ref in sync with the callback
  useEffect(() => {
    runAutoLayoutRef.current = runAutoLayout;
  }, [runAutoLayout]);

  return { runAutoLayout, isRunning };
}
