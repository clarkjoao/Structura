import type { ComponentType, ExternalLink } from "@/features/diagram";

export type NodeData = {
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
  externalLinks?: ExternalLink[];
  onDrillDown?: (elementId: string) => void;
  onEmbed?: (elementId: string) => void;
  recordingBadges?: number[];
  isLastRecorded?: boolean;
  isRecording?: boolean;
  onHandleClick?: (nodeId: string, handleId: string) => void;
  lastRecordedHandleId?: string;
  activeHandleId?: string;
  coverageFlowNames?: string[];
  incomingCount?: number;
  outgoingCount?: number;
  /** Edges that leave/arrive on the mirrored side; 0 or absent means none. */
  outgoingLeftCount?: number;
  incomingRightCount?: number;
  handleOrder?: { incoming: string[]; outgoing: string[] };
  customColor?: string;
  onReorderHandle?: (
    side: "incoming" | "outgoing",
    connId: string,
    direction: "up" | "down",
  ) => void;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
  journeyCount?: number;
  journeyNames?: string[];
};
