import type { Diagram } from "@/features/diagram/model";

export interface ShareContextValue {
  sharedDiagram: Diagram | null;
  clearShared: () => void;
}
