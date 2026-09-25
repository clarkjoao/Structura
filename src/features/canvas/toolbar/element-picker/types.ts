import type { LucideIcon } from "lucide-react";
import type { ComponentType, FlowNodeShape, PanelKind } from "@/features/diagram";
import type { ElementCreateOptions } from "@/features/elements/element.types";

export type CanvasPickerOption = {
  type: ComponentType;
  label: string;
  icon: LucideIcon;
  panelKind?: PanelKind;
  awsIconName?: string;
  flowShape?: FlowNodeShape;
  /** Search synonyms carried by the option itself (registry-derived entries). */
  searchKeys?: string[];
  /** Everything else the palette entry creates with (a lane preset's accent, a line's stroke). */
  createOptions?: ElementCreateOptions;
};

export interface ElementPickerModalProps {
  onClose: () => void;
  onInsert?: (nodeId: string) => void;
}
