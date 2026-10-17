import type {
  ChangeBatchReceipt,
  Diagram,
  DiagramChange,
  DiagramChangeBatchResult,
} from "@/features/diagram";

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
  /** Applies a suggestion's changes as one undo step. */
  applyChanges(changes: DiagramChange[]): DiagramChangeBatchResult;
  /**
   * Lays out the active diagram without taking an undo checkpoint of its own:
   * it runs right after `applyChanges` and undoes together with it.
   */
  autoLayout(): Promise<void>;
  /**
   * Records the diagram as an applied batch (and its layout) left it, so the
   * batch can be taken back; null when the batch took no undo checkpoint.
   */
  takeReceipt(checkpoint: DiagramChangeBatchResult["checkpoint"]): ChangeBatchReceipt | null;
  /** Takes the batch back if nothing changed the diagram since; false otherwise. */
  revertChanges(receipt: ChangeBatchReceipt): boolean;
  /** Whether the batch is still applied, as far as the undo history tells. */
  isInHistory(receipt: ChangeBatchReceipt): boolean;
  /** Removes elements as one undo step: the fallback when a batch cannot be reverted. */
  removeElements(nodeIds: string[], edgeIds: string[]): void;
}
