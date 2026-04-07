import type { Diagram } from "@/features/diagram";

export interface ShareContextValue {
  sharedDiagram: Diagram | null;
  clearShared: () => void;
}
