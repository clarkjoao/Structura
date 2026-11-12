import type { ComponentType, ExternalLink } from "@/features/diagram";

export type NodeData = {
  elementId: string;
  name: string;
  type: ComponentType;
  description: string;
  technology?: string;
  cloudService?: string;
  isSelected: boolean;
  isHighlighted?: boolean;
  /**
   * Every control off whatever the selection (the read-only surfaces). What a
   * selection disables is not on the data: the controls read it themselves
   * (`useSelectionDisablesControls`), so a selection change does not hand
   * every card new data.
   */
  controlsDisabled?: boolean;
  serviceId?: string;
  serviceName?: string;
  linkedDiagramName?: string;
  externalLinks?: ExternalLink[];
  onDrillDown?: (elementId: string) => void;
  onEmbed?: (elementId: string) => void;
  stepBadges?: string[];
  isLastRecorded?: boolean;
  isRecording?: boolean;
  onHandleClick?: (nodeId: string, handleId: string) => void;
  lastRecordedHandleId?: string;
  activeHandleId?: string;
  coverageFlowNames?: string[];
  incomingCount?: number;
  outgoingCount?: number;
  handleOrder?: { incoming: string[]; outgoing: string[] };
  customColor?: string;
  onReorderHandle?: (
    side: "incoming" | "outgoing",
    connId: string,
    direction: "up" | "down",
  ) => void;
  /**
   * The height auto-layout measured this card at, as a floor it cannot fall
   * below. Lives on the card itself, not on React Flow's wrapper, because the
   * handles are positioned against this box — see `laidOutMinHeight` in
   * `buildCardNodeData`.
   */
  laidOutMinHeight?: number;
  versionBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
};
