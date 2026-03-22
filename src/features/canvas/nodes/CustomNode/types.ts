import type { ComponentType } from "@/features/diagram";

export interface NodeData {
  elementId: string;
  name: string;
  type: ComponentType;
  description: string;
  technology?: string;
  awsService?: string;
  isSelected: boolean;
  isHighlighted?: boolean;
  controlsDisabled?: boolean;
  serviceId?: string;
  serviceName?: string;
  linkedDiagramName?: string;
  onDrillDown?: (elementId: string) => void;
  onEmbed?: (elementId: string) => void;
  recordingBadges?: number[];
  isLastRecorded?: boolean;
  isRecording?: boolean;
  onHandleClick?: (nodeId: string, handleId: string) => void;
  lastRecordedHandleId?: string;
  activeHandleId?: string;
  coverageFlowNames?: string[];
  /** Number of target (incoming) handles; 1–4, default 1. */
  incomingCount?: number;
  /** Number of source (outgoing) handles; 1–4, default 1. */
  outgoingCount?: number;
  /** Ordered connection ids per side — drives ↑↓ reorder controls. */
  handleOrder?: { incoming: string[]; outgoing: string[] };
  /** Cor customizada para C4 (borda e ícone). Sobrescreve a cor padrão do tipo. */
  customColor?: string;
  /** Move a connection one position up or down on a given side. */
  onReorderHandle?: (
    side: "incoming" | "outgoing",
    connId: string,
    direction: "up" | "down",
  ) => void;
  sceneBadge?: { name: string; color: string };
}
