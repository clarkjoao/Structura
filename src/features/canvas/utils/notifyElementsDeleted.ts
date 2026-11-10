import { toast } from "sonner";
import type { TFunction } from "i18next";

/** Deleting this many elements in one gesture is announced with an Undo toast. */
export const MASS_DELETE_TOAST_THRESHOLD = 2;

interface NotifyElementsDeletedParams {
  /** Elements (nodes and edges) the gesture removed. */
  count: number;
  undo: () => void;
  t: TFunction;
}

/**
 * Feedback for a bulk delete. The store removes everything as one history step, so a single
 * `undo` restores the lot. Single deletes stay silent, and nothing asks for confirmation.
 */
export function notifyElementsDeleted({ count, undo, t }: NotifyElementsDeletedParams): void {
  if (count < MASS_DELETE_TOAST_THRESHOLD) return;
  toast(t("canvas.elementsDeleted", { count }), {
    action: { label: t("canvas.elementsDeletedUndo"), onClick: undo },
  });
}

/**
 * Wraps the store's `removeElements` so the canvas layer announces bulk deletes without the
 * slice knowing about the UI.
 */
export function withDeleteFeedback(
  removeElements: (nodeIds: string[], edgeIds: string[]) => void,
  undo: () => void,
  t: TFunction,
): (nodeIds: string[], edgeIds: string[]) => void {
  return (nodeIds, edgeIds) => {
    removeElements(nodeIds, edgeIds);
    notifyElementsDeleted({ count: nodeIds.length + edgeIds.length, undo, t });
  };
}
