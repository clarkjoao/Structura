import type { DiagramExportFormat } from "@/lib/export-service";
import type { Flow } from "@/features/diagram";
import type { ReactFlowInstance } from "@xyflow/react";

export type CopiedClipboardKind = "drawio" | "json";

export interface ExportBuildResult {
  /** Files generated for download. */
  files: { filename: string; content: string | Blob; mime: string }[];
  /** Human-readable errors from visual (SVG/PNG) exports. Empty when all succeeded. */
  visualErrors: string[];
}

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
  handleExportFormats: (
    formats: DiagramExportFormat[],
    pluginExporterIds: string[],
    reactFlowInstance?: ReactFlowInstance,
    framing?: "viewport" | "full",
  ) => Promise<ExportBuildResult>;
  onStartCollab: () => void;
  onCollabSessionEnded?: () => void;
  copiedClipboardKind: CopiedClipboardKind | null;
  flows: Flow[];
  backHref: string;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}
