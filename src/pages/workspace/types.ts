import type { DiagramExportFormat } from "@/lib/export-service";
import type { Flow } from "@/features/diagram";

export type CopiedClipboardKind = "drawio" | "json";

export interface WorkspaceContentProps {
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
  /** Back to the diagram at `index` of `navStack` (a breadcrumb), dropping what came after it. */
  handleDrillUpTo: (index: number) => void;
  handleCopyDrawio: () => void;
  handleCopyJson: () => void;
  handleExportFormats: (formats: DiagramExportFormat[], pluginExporterIds: string[]) => void;
  onStartCollab: () => void;
  onCollabSessionEnded?: () => void;
  copiedClipboardKind: CopiedClipboardKind | null;
  flows: Flow[];
  backHref: string;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}
