import { useState } from "react";

export interface QuickInsertState {
  screenPos: { x: number; y: number };
  flowPos: { x: number; y: number };
  sourceNodeId?: string | null;
}

export interface UseCanvasContextMenusResult {
  contextMenu: { x: number; y: number; elementId: string } | null;
  setContextMenu: (menu: { x: number; y: number; elementId: string } | null) => void;
  quickInsert: QuickInsertState | null;
  setQuickInsert: (value: QuickInsertState | null) => void;
  paneContextMenu: { x: number; y: number } | null;
  setPaneContextMenu: (value: { x: number; y: number } | null) => void;
}

/** Encapsulates all canvas context-menu and quick-insert state. */
export function useCanvasContextMenus(): UseCanvasContextMenusResult {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    elementId: string;
  } | null>(null);
  const [quickInsert, setQuickInsert] = useState<QuickInsertState | null>(null);
  const [paneContextMenu, setPaneContextMenu] = useState<{ x: number; y: number } | null>(null);

  return {
    contextMenu,
    setContextMenu,
    quickInsert,
    setQuickInsert,
    paneContextMenu,
    setPaneContextMenu,
  };
}
