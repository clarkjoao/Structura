export interface CanvasProps {
  onOpenDiagram?: (id: string) => void;
  onDrillUp?: () => void;
  isViewingCoverage?: boolean;
  isFlowPanelOpen?: boolean;
  onPlayFlow?: (flowId: string) => void;
  /** When set with `onDiagramSidebarOpenChange`, sidebar open state is controlled by the parent (e.g. top bar toggle). */
  diagramSidebarOpen?: boolean;
  onDiagramSidebarOpenChange?: (open: boolean) => void;
}
