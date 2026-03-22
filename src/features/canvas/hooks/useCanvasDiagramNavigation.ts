import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { Diagram } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";
import type { NavigateFunction } from "react-router-dom";
import { useRecentDiagrams } from "../navigation/useRecentDiagrams";

type NavParams = { diagram: Diagram | null | undefined; allDiagrams: Record<string, Diagram>; diagramNavLocked: boolean; actions: Pick<ReturnType<typeof useDiagramActions>, "openDiagram">; onOpenDiagram?: (id: string) => void; diagramSidebarOpen?: boolean; onDiagramSidebarOpenChange?: (open: boolean) => void; navigate: NavigateFunction; setShowScenes: Dispatch<SetStateAction<boolean>> };
type NavResult = { showSearch: boolean; setShowSearch: (v: boolean) => void; showDiagramSidebar: boolean; setShowDiagramSidebar: Dispatch<SetStateAction<boolean>>; showCommandPalette: boolean; setShowCommandPalette: (v: boolean) => void; handleSelectDiagram: (id: string) => void };

export function useCanvasDiagramNavigation({ diagram, allDiagrams, diagramNavLocked, actions, onOpenDiagram, diagramSidebarOpen: controlledDiagramSidebarOpen, onDiagramSidebarOpenChange, navigate, setShowScenes }: NavParams): NavResult {
  const [showSearch, setShowSearch] = useState(false);
  const [internalDiagramSidebar, setInternalDiagramSidebar] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const diagramSidebarControlled = typeof onDiagramSidebarOpenChange === "function";
  const showDiagramSidebar = diagramSidebarControlled ? Boolean(controlledDiagramSidebarOpen) : internalDiagramSidebar;
  const setShowDiagramSidebar = useCallback(
    (value: SetStateAction<boolean>) => {
      if (diagramSidebarControlled) {
        onDiagramSidebarOpenChange?.(typeof value === "function" ? value(Boolean(controlledDiagramSidebarOpen)) : value);
      } else setInternalDiagramSidebar(value);
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
      if (onOpenDiagram) onOpenDiagram(id);
      else {
        actions.openDiagram(id);
        navigate(`/model/${id}`);
      }
    },
    [actions, allDiagrams, diagram?.id, diagramNavLocked, navigate, onOpenDiagram, setShowCommandPalette, setShowDiagramSidebar],
  );
  useEffect(() => {
    if (!diagramNavLocked) return;
    setShowCommandPalette(false);
    setShowSearch(false);
    setShowDiagramSidebar(false);
    setShowScenes(false);
  }, [diagramNavLocked, setShowDiagramSidebar, setShowScenes]);
  return { showSearch, setShowSearch, showDiagramSidebar, setShowDiagramSidebar, showCommandPalette, setShowCommandPalette, handleSelectDiagram };
}
