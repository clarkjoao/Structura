import { useEffect, type Dispatch, type SetStateAction } from "react";

/**
 * A flow takes the canvas over: entering one closes the versions drawer and the
 * diagram sidebar. Opening another diagram closes the versions drawer too.
 */
export function useFlowModeClosesChrome({
  isFlowActive,
  diagramId,
  showVersions,
  setShowVersions,
  showDiagramSidebar,
  setShowDiagramSidebar,
}: {
  isFlowActive: boolean;
  diagramId: string | undefined;
  showVersions: boolean;
  setShowVersions: Dispatch<SetStateAction<boolean>>;
  showDiagramSidebar: boolean;
  setShowDiagramSidebar: Dispatch<SetStateAction<boolean>>;
}): void {
  useEffect(() => {
    if (isFlowActive && showVersions) {
      setShowVersions(false);
    }
  }, [isFlowActive, showVersions, setShowVersions]);

  useEffect(() => {
    if (isFlowActive && showDiagramSidebar) {
      setShowDiagramSidebar(false);
    }
  }, [isFlowActive, showDiagramSidebar, setShowDiagramSidebar]);

  useEffect(() => {
    setShowVersions(false);
  }, [diagramId, setShowVersions]);
}
