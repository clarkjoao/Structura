import { useEffect, useRef } from "react";
import { ViewportPortal, useNodesInitialized, useReactFlow, useStoreApi } from "@xyflow/react";
import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import { kindOverlayFor } from "@/features/diagram-kinds/overlay";
import { KindOverlayView } from "@/features/canvas/chrome/KindOverlayLayer";
import { frameDiagram } from "@/features/canvas/focus/frameDiagram";
import { FIT_VIEW_OPTIONS_READ } from "@/features/canvas/core/reactFlowBaseConfig";

/**
 * The diagram kind's overlay on a read-only surface (spec guided-overlay-fit-export):
 * the phase band drawn without click selection. With `frame`, once React Flow
 * has measured the nodes and fitted them, the band is framed with them.
 */
export function ViewerKindOverlay({ diagram, frame }: { diagram: DiagramModel; frame: boolean }) {
  const overlay = kindOverlayFor(diagram);
  const instance = useReactFlow();
  const store = useStoreApi();
  const initialized = useNodesInitialized();
  const framed = useRef(false);

  useEffect(() => {
    if (!frame || !overlay || !initialized || framed.current) return;
    framed.current = true;
    // After React Flow's own fit (the surface's `fitView`), which this widens to the band.
    const id = requestAnimationFrame(
      () => void frameDiagram(instance, store.getState(), overlay, FIT_VIEW_OPTIONS_READ),
    );
    return () => cancelAnimationFrame(id);
  }, [frame, overlay, initialized, instance, store]);

  if (!overlay) return null;
  return (
    <ViewportPortal>
      <KindOverlayView overlay={overlay} />
    </ViewportPortal>
  );
}
