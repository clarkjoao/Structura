import type { Diagram, DiagramChange, DiagramChangeBatchResult } from "@/features/diagram";

/**
 * Everything the chat's tools and suggestions need from the diagram, provided
 * by whoever mounts the chat. Keeps the llm feature free of canvas code.
 */
export interface DiagramToolHost {
  /**
   * The active diagram as the canvas shows it (the active version applied to
   * its components and connections), or null when no diagram is open.
   */
  readDiagram(): Diagram | null;
  /** Applies an accepted suggestion's changes as one undo step. */
  applyChanges(changes: DiagramChange[]): DiagramChangeBatchResult;
  /**
   * Lays out the active diagram without taking an undo checkpoint of its own:
   * it runs right after `applyChanges` and undoes together with it.
   */
  autoLayout(): Promise<void>;
}
