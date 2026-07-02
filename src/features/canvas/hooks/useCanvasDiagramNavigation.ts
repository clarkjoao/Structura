import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";
import type { NavigateFunction } from "react-router-dom";
import { useRecentDiagrams } from "../navigation/useRecentDiagrams";

interface CanvasDiagramNavParams {
  diagram: Diagram | DiagramModel | null | undefined;
  allDiagrams: Record<string, Diagram>;
  diagramNavLocked: boolean;
  clearCanvasSelection: () => void;
  actions: Pick<ReturnType<typeof useDiagramActions>, "openDiagram">;
  onOpenDiagram?: (id: string) => void;
  diagramSidebarOpen?: boolean;
  onDiagramSidebarOpenChange?: (open: boolean) => void;
  navigate: NavigateFunction;
  setShowScenes: Dispatch<SetStateAction<boolean>>;
}

interface CanvasDiagramNavResult {
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  showDiagramSidebar: boolean;
  setShowDiagramSidebar: Dispatch<SetStateAction<boolean>>;
  showCommandPalette: boolean;
  setShowCommandPalette: (v: boolean) => void;

  handleSelectDiagram: (id: string) => void;
}

function useCloseAllOnNavLock({
  diagramNavLocked,
  setShowCommandPalette,
  setShowSearch,
  setShowDiagramSidebar,
  setShowScenes,
}: {
  diagramNavLocked: boolean;
  setShowCommandPalette: (v: boolean) => void;
  setShowSearch: (v: boolean) => void;
  setShowDiagramSidebar: Dispatch<SetStateAction<boolean>>;
  setShowScenes: Dispatch<SetStateAction<boolean>>;
}) {
  useEffect(() => {
    if (!diagramNavLocked) return;
    setShowCommandPalette(false);
    setShowSearch(false);
    setShowDiagramSidebar(false);
    setShowScenes(false);
  }, [diagramNavLocked, setShowDiagramSidebar, setShowScenes]);
}

export function useCanvasDiagramNavigation(params: CanvasDiagramNavParams): CanvasDiagramNavResult {
  const {
    diagram,
    allDiagrams,
    diagramNavLocked,
    clearCanvasSelection,
    actions,
    onOpenDiagram,
    diagramSidebarOpen: controlledDiagramSidebarOpen,
    onDiagramSidebarOpenChange,
    navigate,
    setShowScenes,
  } = params;

  const [showSearch, setShowSearch] = useState(false);
  const [internalDiagramSidebar, setInternalDiagramSidebar] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const diagramSidebarControlled = typeof onDiagramSidebarOpenChange === "function";
  const showDiagramSidebar = diagramSidebarControlled
    ? Boolean(controlledDiagramSidebarOpen)
    : internalDiagramSidebar;

  const setShowDiagramSidebar = useCallback(
    (value: SetStateAction<boolean>) => {
      if (diagramSidebarControlled) {
        onDiagramSidebarOpenChange?.(
          typeof value === "function" ? value(Boolean(controlledDiagramSidebarOpen)) : value,
        );
      } else {
        setInternalDiagramSidebar(value);
      }
    },
    [controlledDiagramSidebarOpen, diagramSidebarControlled, onDiagramSidebarOpenChange],
  );

  const { recordOpened } = useRecentDiagrams();

  useEffect(() => {
    if (diagram) recordOpened(diagram.id);
  }, [diagram, recordOpened]);

  const handleSelectDiagram = useCallback(
    (id: string) => {
      if (diagramNavLocked) return;

      const target = allDiagrams[id];
      if (!target) return;

      if (id === diagram?.id) {
        setShowDiagramSidebar(false);
        setShowCommandPalette(false);
        return;
      }

      clearCanvasSelection();
      if (onOpenDiagram) {
        onOpenDiagram(id);
      } else {
        actions.openDiagram(id);
        navigate(`/model/${id}`);
      }
    },
    [
      actions,
      allDiagrams,
      clearCanvasSelection,
      diagram?.id,
      diagramNavLocked,
      navigate,
      onOpenDiagram,
      setShowCommandPalette,
      setShowDiagramSidebar,
    ],
  );

  useCloseAllOnNavLock({
    diagramNavLocked,
    setShowCommandPalette,
    setShowSearch,
    setShowDiagramSidebar,
    setShowScenes,
  });

  return {
    showSearch,
    setShowSearch,
    showDiagramSidebar,
    setShowDiagramSidebar,
    showCommandPalette,
    setShowCommandPalette,
    handleSelectDiagram,
  };
}
