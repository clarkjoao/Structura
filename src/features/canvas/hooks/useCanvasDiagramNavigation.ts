import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { Diagram } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";
import type { NavigateFunction } from "react-router-dom";
import { useRecentDiagrams } from "../navigation/useRecentDiagrams";

/** Parameters for the canvas diagram navigation hook. */
interface CanvasDiagramNavParams {
  /** Diagrama atualmente ativo no canvas */
  diagram: Diagram | null | undefined;
  /** Todos os diagramas disponíveis para navegação */
  allDiagrams: Record<string, Diagram>;
  /** Quando true, navegação entre diagramas está bloqueada
   *  (flow playing/recording ou compare mode ativo) */
  diagramNavLocked: boolean;
  actions: Pick<ReturnType<typeof useDiagramActions>, "openDiagram">;
  onOpenDiagram?: (id: string) => void;
  /** Quando fornecido, sidebar é controlada externamente */
  diagramSidebarOpen?: boolean;
  onDiagramSidebarOpenChange?: (open: boolean) => void;
  navigate: NavigateFunction;
  setShowScenes: Dispatch<SetStateAction<boolean>>;
}

/** Return value of the canvas diagram navigation hook. */
interface CanvasDiagramNavResult {
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  showDiagramSidebar: boolean;
  setShowDiagramSidebar: Dispatch<SetStateAction<boolean>>;
  showCommandPalette: boolean;
  setShowCommandPalette: (v: boolean) => void;
  /** Abre um diagrama respeitando o lock de navegação */
  handleSelectDiagram: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Internal helper hook
// ---------------------------------------------------------------------------

/**
 * Closes all overlay panels (command palette, search, diagram sidebar, scenes)
 * whenever diagram navigation becomes locked.
 */
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
  }, [diagramNavLocked, setShowCommandPalette, setShowDiagramSidebar, setShowScenes, setShowSearch]);
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useCanvasDiagramNavigation(
  params: CanvasDiagramNavParams,
): CanvasDiagramNavResult {
  const {
    diagram,
    allDiagrams,
    diagramNavLocked,
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

      // Early-return when the selected diagram is already active.
      // This avoids an unnecessary re-render that would be triggered by
      // re-opening the same diagram; instead we just close the overlays.
      if (id === diagram?.id) {
        setShowDiagramSidebar(false);
        setShowCommandPalette(false);
        return;
      }

      if (onOpenDiagram) {
        onOpenDiagram(id);
      } else {
        actions.openDiagram(id);
        navigate(`/model/${id}`);
      }
    },
    [actions, allDiagrams, diagram?.id, diagramNavLocked, navigate, onOpenDiagram, setShowCommandPalette, setShowDiagramSidebar],
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
