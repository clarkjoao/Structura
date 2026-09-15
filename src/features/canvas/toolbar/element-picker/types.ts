import type { LucideIcon } from "lucide-react";
import type { ComponentType, FlowNodeShape, PanelKind } from "@/features/diagram";

export type CanvasPickerOption = {
  type: ComponentType;
  label: string;
  icon: LucideIcon;
  panelKind?: PanelKind;
  awsIconName?: string;
  flowShape?: FlowNodeShape;
  /** Search synonyms carried by the option itself (registry-derived entries). */
  searchKeys?: string[];
};

export interface ElementPickerModalProps {
  onClose: () => void;
  onInsert?: (nodeId: string) => void;
}
