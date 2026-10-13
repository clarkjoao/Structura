import type { Diagram } from "@/features/diagram";

/**
 * Everything the chat's tools need from the diagram, provided by whoever
 * mounts the chat. Keeps tool execution free of store and canvas internals.
 */
export interface DiagramToolHost {
  /**
   * The active diagram as the canvas shows it (the active version applied to
   * its components and connections), or null when no diagram is open.
   */
  readDiagram(): Diagram | null;
}
