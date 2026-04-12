import type { DiagramExportFormat } from "@/lib/export-service";
import type { Flow } from "@/features/diagram";

export type CopiedClipboardKind = "drawio" | "json" | "structurizr";

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
  onOpenImport: () => void;
  handleCopyDrawio: () => void;
  handleCopyJson: () => void;
  handleCopyStructurizr: () => void;
  handleExportFormats: (formats: DiagramExportFormat[]) => void;
  onStartCollab: () => void;
  onCollabSessionEnded?: () => void;
  copiedClipboardKind: CopiedClipboardKind | null;
  flows: Flow[];
  backHref: string;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}
