export interface CanvasProps {
  onOpenDiagram?: (id: string) => void;
  onDrillDownToDiagram?: (id: string) => void;
  isViewingCoverage?: boolean;
  isFlowPanelOpen?: boolean;
  /**
   * The flows list holds the inspector's column; a click on an element hands the column back
   * (closes the list) and selects it, rather than the canvas going inert while the list is open.
   */
  onYieldFlowPanel?: () => void;
  onPlayFlow?: (flowId: string) => void;
  diagramSidebarOpen?: boolean;
  onDiagramSidebarOpenChange?: (open: boolean) => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  /** Offer the LLM chat (default true). Hosts with their own assistant — VSCode — turn it off. */
  showChat?: boolean;
}
