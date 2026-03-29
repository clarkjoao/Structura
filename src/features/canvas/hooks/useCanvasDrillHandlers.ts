import { useCallback } from "react";
import type { Diagram } from "@/features/diagram";
import { isNoteComponent, isPanelComponent, resolveCanvasSnapshot } from "@/features/diagram";
import {
  NOTE_DEFAULT_W,
  NOTE_DEFAULT_H,
  NOTE_COLLAPSED_W,
  NOTE_COLLAPSED_H,
  PANEL_DEFAULT_W,
  PANEL_DEFAULT_H,
  PANEL_COLLAPSED_W,
  PANEL_COLLAPSED_H,
} from "../constants";

interface UseCanvasDrillHandlersParams {
  diagram: Diagram | null | undefined;
  allDiagrams: Record<string, Diagram>;
  updateComponent: (id: string, patch: Record<string, unknown>) => void;
  openDiagram: (id: string) => void;
  navigate: (path: string) => void;
  onOpenDiagram?: (id: string) => void;
  onDrillDownToDiagram?: (id: string) => void;
}

export function useCanvasDrillHandlers({
  diagram,
  allDiagrams,
  updateComponent,
  openDiagram,
  navigate,
  onOpenDiagram,
  onDrillDownToDiagram,
}: UseCanvasDrillHandlersParams) {
  const handleDrillDown = useCallback(
    (elementId: string) => {
      if (!diagram) return;
      const r = resolveCanvasSnapshot(diagram);
      const comp = r.components[elementId];
      if (!comp?.linkedDiagramId || !allDiagrams[comp.linkedDiagramId]) return;

      if (onDrillDownToDiagram) {
        onDrillDownToDiagram(comp.linkedDiagramId);
      } else if (onOpenDiagram) {
        onOpenDiagram(comp.linkedDiagramId);
      } else {
        openDiagram(comp.linkedDiagramId);
        navigate(`/diagram/${comp.linkedDiagramId}`);
      }
    },
    [diagram, allDiagrams, openDiagram, navigate, onDrillDownToDiagram, onOpenDiagram],
  );

  const handlePanelCollapseToggle = useCallback(
    (nodeId: string) => {
      if (!diagram) return;
      const r = resolveCanvasSnapshot(diagram);
      const comp = r.components[nodeId];
      const layout = r.nodeLayouts[nodeId];

      if (isPanelComponent(comp)) {
        const children = Object.values(r.components).filter((c) => c.parentId === nodeId);

        if (comp.collapsed) {
          updateComponent(nodeId, {
            collapsed: false,
            width: comp.collapsedWidth ?? PANEL_DEFAULT_W,
            height: comp.collapsedHeight ?? PANEL_DEFAULT_H,
          });
          children.forEach((c) => updateComponent(c.id, { hidden: false }));
        } else {
          updateComponent(nodeId, {
            collapsed: true,
            collapsedWidth: layout?.width,
            collapsedHeight: layout?.height,
            width: PANEL_COLLAPSED_W,
            height: PANEL_COLLAPSED_H,
          });
          children.forEach((c) => updateComponent(c.id, { hidden: true }));
        }
        return;
      }

      if (isNoteComponent(comp)) {
        if (comp.collapsed) {
          updateComponent(nodeId, {
            collapsed: false,
            width: comp.collapsedWidth ?? NOTE_DEFAULT_W,
            height: comp.collapsedHeight ?? NOTE_DEFAULT_H,
          });
        } else {
          updateComponent(nodeId, {
            collapsed: true,
            collapsedWidth: layout?.width,
            collapsedHeight: layout?.height,
            width: NOTE_COLLAPSED_W,
            height: NOTE_COLLAPSED_H,
          });
        }
      }
    },
    [diagram, updateComponent],
  );

  return { handleDrillDown, handlePanelCollapseToggle };
}
