export interface CanvasProps {
  onOpenDiagram?: (id: string) => void;
  onDrillDownToDiagram?: (id: string) => void;
  isViewingCoverage?: boolean;
  isFlowPanelOpen?: boolean;
  onPlayFlow?: (flowId: string) => void;
  diagramSidebarOpen?: boolean;
  onDiagramSidebarOpenChange?: (open: boolean) => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}
