import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useReactFlow } from "@xyflow/react";
import { useActiveDiagram } from "@/features/diagram";
import { focusComponentsOnCanvas } from "../focus/focusComponents";
import type { CanvasVisualState } from "./useCanvasVisualState";

export function useElementFocusFromUrl(visualState: CanvasVisualState): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const diagram = useActiveDiagram();
  const reactFlowInstance = useReactFlow();
  const { t } = useTranslation();
  const processedRef = useRef<string | null>(null);

  const nodeId = searchParams.get("nodeId");

  useEffect(() => {
    if (!nodeId) {
      processedRef.current = null;
    }
  }, [nodeId, diagram?.id]);

  useEffect(() => {
    if (!nodeId || !diagram) return;

    const focusKey = `${diagram.id}:${nodeId}`;
    if (processedRef.current === focusKey) return;

    const clearParam = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("nodeId");
      setSearchParams(next, { replace: true });
    };

    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;

        const node = reactFlowInstance.getNode(nodeId);
        if (!node) {
          processedRef.current = focusKey;
          toast.error(t("canvas.focusNodeNotFound"));
          clearParam();
          return;
        }

        processedRef.current = focusKey;
        focusComponentsOnCanvas(reactFlowInstance, visualState, [nodeId]);
        clearParam();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [nodeId, diagram, reactFlowInstance, searchParams, setSearchParams, t, visualState]);
}
