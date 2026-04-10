import type { Flow } from "@/features/diagram";

export interface ModelExplorerContentProps {
  showFlows: boolean;
  setShowFlows: (v: boolean) => void;
  isViewingCoverage: boolean;
  setIsViewingCoverage: (v: boolean | ((prev: boolean) => boolean)) => void;
  showShortcuts: boolean;
  setShowShortcuts: (v: boolean) => void;
  navStack: string[];
  handleOpenDiagram: (id: string) => void;
  handleDrillDownToDiagram: (id: string) => void;
  handleDrillUp: () => void;
  handleCopyDrawio: () => void;
  handleCopyJson: () => void;
  handleExport: () => void;
  onStartCollab: () => void;
  onCollabSessionEnded?: () => void;
  copied: boolean;
  flows: Flow[];
  backHref: string;
}
