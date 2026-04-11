export interface CanvasProps {
  onOpenDiagram?: (id: string) => void;
  
  onDrillDownToDiagram?: (id: string) => void;
  onDrillUp?: () => void;
  isViewingCoverage?: boolean;
  isFlowPanelOpen?: boolean;
  onPlayFlow?: (flowId: string) => void;
  
  diagramSidebarOpen?: boolean;
  onDiagramSidebarOpenChange?: (open: boolean) => void;
}
