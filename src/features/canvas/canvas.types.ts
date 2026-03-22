export interface CanvasProps {
  onOpenDiagram?: (id: string) => void;
  /** Open linked diagram from canvas drill-down (pushes “level up” stack); sidebar / Command K use `onOpenDiagram` only. */
  onDrillDownToDiagram?: (id: string) => void;
  onDrillUp?: () => void;
  isViewingCoverage?: boolean;
  isFlowPanelOpen?: boolean;
  onPlayFlow?: (flowId: string) => void;
  /** When set with `onDiagramSidebarOpenChange`, sidebar open state is controlled by the parent (e.g. top bar toggle). */
  diagramSidebarOpen?: boolean;
  onDiagramSidebarOpenChange?: (open: boolean) => void;
}
