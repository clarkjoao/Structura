import { useCallback, useRef } from "react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import {
  isDbTableComponent,
  isNoteComponent,
  isPanelComponent,
  getCachedCanvasSnapshot,
} from "@/features/diagram";
import {
  NOTE_DEFAULT_W,
  NOTE_DEFAULT_H,
  NOTE_COLLAPSED_W,
  NOTE_COLLAPSED_H,
  PANEL_DEFAULT_W,
  PANEL_DEFAULT_H,
  PANEL_COLLAPSED_W,
  PANEL_COLLAPSED_H,
  DB_TABLE_COLLAPSED_W,
  DB_TABLE_COLLAPSED_H,
} from "../constants";

const DB_TABLE_EXPAND_FIXED_H = 32 + 22 + 20 + 2;
const DB_TABLE_EXPAND_ROW_H = 24;
const DB_TABLE_EXPAND_DEFAULT_W = 406;

function defaultExpandedDbTableHeight(columnCount: number): number {
  return DB_TABLE_EXPAND_FIXED_H + columnCount * DB_TABLE_EXPAND_ROW_H;
}

interface UseCanvasDrillHandlersParams {
  diagram: Diagram | DiagramModel | null | undefined;
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
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;
  const allDiagramsRef = useRef(allDiagrams);
  allDiagramsRef.current = allDiagrams;

  const handleDrillDown = useCallback(
    (elementId: string) => {
      const d = diagramRef.current;
      if (!d) return;
      const r = getCachedCanvasSnapshot(d);
      const comp = r.components[elementId];
      if (!comp?.linkedDiagramId || !allDiagramsRef.current[comp.linkedDiagramId]) return;

      if (onDrillDownToDiagram) {
        onDrillDownToDiagram(comp.linkedDiagramId);
      } else if (onOpenDiagram) {
        onOpenDiagram(comp.linkedDiagramId);
      } else {
        openDiagram(comp.linkedDiagramId);
        navigate(`/diagram/${comp.linkedDiagramId}`);
      }
    },
    [openDiagram, navigate, onDrillDownToDiagram, onOpenDiagram],
  );

  const handlePanelCollapseToggle = useCallback(
    (nodeId: string) => {
      const d = diagramRef.current;
      if (!d) return;
      const r = getCachedCanvasSnapshot(d);
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
        return;
      }

      if (isDbTableComponent(comp)) {
        if (comp.collapsed) {
          updateComponent(nodeId, {
            collapsed: false,
            width: comp.collapsedWidth ?? DB_TABLE_EXPAND_DEFAULT_W,
            height:
              comp.collapsedHeight ??
              defaultExpandedDbTableHeight(comp.columns.length),
          });
        } else {
          updateComponent(nodeId, {
            collapsed: true,
            collapsedWidth: layout?.width,
            collapsedHeight: layout?.height,
            width: DB_TABLE_COLLAPSED_W,
            height: DB_TABLE_COLLAPSED_H,
          });
        }
      }
    },
    [updateComponent],
  );

  return { handleDrillDown, handlePanelCollapseToggle };
}
