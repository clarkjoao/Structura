import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useReactFlow } from "@xyflow/react";
import { useActiveDiagram } from "@/features/diagram";
import { findComponentIdsByServiceId } from "@/pages/serviceRegistry/findComponentsByServiceId";
import { focusComponentsOnCanvas } from "../focus/focusComponents";
import type { CanvasVisualState } from "./useCanvasVisualState";

export function useServiceFocusFromUrl(visualState: CanvasVisualState): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const diagram = useActiveDiagram();
  const reactFlowInstance = useReactFlow();
  const { t } = useTranslation();
  const processedRef = useRef<string | null>(null);

  const serviceId = searchParams.get("serviceId");

  useEffect(() => {
    if (!serviceId) {
      processedRef.current = null;
    }
  }, [serviceId, diagram?.id]);

  useEffect(() => {
    if (!serviceId || !diagram) return;

    const focusKey = `${diagram.id}:${serviceId}`;
    if (processedRef.current === focusKey) return;

    const componentIds = findComponentIdsByServiceId(diagram, serviceId);

    const clearServiceIdParam = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("serviceId");
      setSearchParams(next, { replace: true });
    };

    if (componentIds.length === 0) {
      processedRef.current = focusKey;
      toast.error(t("registry.focusServiceNotFound"));
      clearServiceIdParam();
      return;
    }

    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;

        const readyIds = componentIds.filter((id) => reactFlowInstance.getNode(id));
        if (readyIds.length === 0) return;

        processedRef.current = focusKey;
        focusComponentsOnCanvas(reactFlowInstance, visualState, readyIds);
        clearServiceIdParam();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [
    serviceId,
    diagram,
    diagram?.snapshot.components,
    reactFlowInstance,
    searchParams,
    setSearchParams,
    t,
    visualState,
  ]);
}
