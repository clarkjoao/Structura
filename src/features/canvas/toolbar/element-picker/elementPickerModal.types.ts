import type { LucideIcon } from "lucide-react";
import type { ComponentType, PanelKind } from "@/features/diagram";

export type CanvasPickerOption = {
  type: ComponentType;
  label: string;
  icon: LucideIcon;
  panelKind?: PanelKind;
  awsIconName?: string;
};

export interface ElementPickerModalProps {
  onClose: () => void;
  onInsert?: (nodeId: string) => void;
}
