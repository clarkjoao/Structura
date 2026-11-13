import { useCallback, useMemo } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type {
  Diagram,
  DiagramLayoutSettings,
  DiagramModel,
  useConnections,
  useResolvedComponents,
  useResolvedNodeLayouts,
} from "@/features/diagram";
import { edgeLabelBox } from "../layout/edgeLabelBox";
import { useAutoLayout, type AutoLayoutRunOptions } from "./useAutoLayout";

/**
 * Arrange for the editor canvas: the run over the measured nodes, its two
 * menu entry points, and whether the layout reserves room for edge labels.
 */
export function useCanvasArrange({
  diagram,
  reactFlowInstance,
  resolvedComponents,
  resolvedConnections,
  resolvedNodeLayouts,
}: {
  diagram: Diagram | DiagramModel | null | undefined;
  reactFlowInstance: ReactFlowInstance;
  resolvedComponents: ReturnType<typeof useResolvedComponents>;
  resolvedConnections: ReturnType<typeof useConnections>;
  resolvedNodeLayouts: ReturnType<typeof useResolvedNodeLayouts>;
}) {
  const { runAutoLayout, placeTouched, isRunning: isAutoLayoutRunning } = useAutoLayout();
  /**
   * Arranges the diagram. With `settings`, arranges with those instead of the
   * diagram's and stores them in the same undo step (the Arrange menu).
   */
  const arrange = useCallback(
    async (options: AutoLayoutRunOptions = {}) => {
      if (!diagram) return;
      const measuredNodes = reactFlowInstance.getNodes();
      await runAutoLayout(
        resolvedComponents,
        Object.values(resolvedConnections),
        resolvedNodeLayouts,
        measuredNodes,
        options,
      );
    },
    [
      diagram,
      runAutoLayout,
      resolvedComponents,
      resolvedConnections,
      resolvedNodeLayouts,
      reactFlowInstance,
    ],
  );
  const handleAutoLayout = useCallback(() => void arrange(), [arrange]);
  const handleArrangeWithSettings = useCallback(
    (settings: DiagramLayoutSettings) => void arrange({ settings }),
    [arrange],
  );
  /** Whether the layout reserves room for edge labels, which picks its tuned layer gap. */
  const arrangeLabelled = useMemo(
    () =>
      Object.values(resolvedConnections).some(
        (connection) => edgeLabelBox(connection.label, connection.technology) !== undefined,
      ),
    [resolvedConnections],
  );
  return {
    arrange,
    handleAutoLayout,
    handleArrangeWithSettings,
    arrangeLabelled,
    placeTouched,
    isAutoLayoutRunning,
  };
}
