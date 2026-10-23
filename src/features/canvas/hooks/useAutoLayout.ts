import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow, useStoreApi } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { measuredSizesOf } from "../layout/applyLayout";
import { applyDiagramAutoLayout, planDiagramAutoLayout } from "../layout/autoLayoutDiagram";
import { startLayoutTransition } from "../layout/layoutTransition";
import { useDiagramActions, useDiagramStore } from "@/features/diagram";
import type { Component, Connection, DiagramLayoutSettings, NodeLayout } from "@/features/diagram";
import type { Node } from "@xyflow/react";

export interface AutoLayoutRunOptions {
  /**
   * Arrange with these settings instead of the diagram's, and store them in the
   * same undo step — what a change in the Arrange menu does.
   */
  settings?: DiagramLayoutSettings;
  /**
   * The automatic mode's run after a structural edit: it joins the edit's undo
   * step, keeps the user's viewport and says nothing unless it fails.
   */
  automatic?: boolean;
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
          if (!options.automatic) toast.info(t("autoLayout.nothingToLayout"));
          return;
        }

        endTransitionRef.current = startLayoutTransition(reactFlowStore.getState().domNode);
        const diagramId = useDiagramStore.getState().activeDiagramId;
        const history = !options.automatic;
        if (diagramId !== null) applyDiagramAutoLayout(plan, diagramId, { writeSettings, history });
        else applyAutoLayout(plan.layouts, plan.autoRefs, history ? undefined : { history });

        if (options.automatic) return;
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

  return { runAutoLayout, isRunning };
}
