import {
  shouldYieldCanvasShortcutToFocusedField,
  type KeyHandler,
} from "./helpers";
import { runClaimingChain } from "./runClaimingChain";
import {
  handleAutoLayoutShortcut,
  handleCompareModeKeys,
  handleSaveShortcut,
  handleScenesDrawerKey,
  isCanvasEditingLocked,
  isCanvasOverlayOpen,
  type CanvasKeydownModeFlags,
} from "./canvasKeydownGates";

export interface CanvasKeydownDispatch {
  flags: CanvasKeydownModeFlags;
  hasDiagram: boolean;
  onCloseScenesDrawer?: () => void;
  forceSaveToFolder: () => void | Promise<void>;
  onAutoLayout?: () => void;
  setCompareScene: (sceneId: string | null) => void;
  recordingHandler: KeyHandler;
  /** Handlers that mutate the diagram / selection; claimed on success. */
  editHandlers: readonly KeyHandler[];
  toolHandler: KeyHandler;
}

/**
 * Single entry for canvas keydown. Order is intentional: focus yield → overlays →
 * save/layout (allowed outside some locks) → recording → compare guards →
 * edit chain → tool chords.
 */
export async function dispatchCanvasKeydown(
  event: KeyboardEvent,
  dispatch: CanvasKeydownDispatch,
): Promise<void> {
  if (shouldYieldCanvasShortcutToFocusedField(event)) return;

  if (handleScenesDrawerKey(event, dispatch.flags, dispatch.onCloseScenesDrawer)) return;

  if (handleSaveShortcut(event, dispatch.flags, dispatch.forceSaveToFolder)) return;

  if (!dispatch.hasDiagram) return;

  if (handleAutoLayoutShortcut(event, dispatch.flags, dispatch.onAutoLayout)) return;

  if (dispatch.recordingHandler(event)) return;

  if (handleCompareModeKeys(event, dispatch.flags, dispatch.setCompareScene)) return;

  if (isCanvasEditingLocked(dispatch.flags) || isCanvasOverlayOpen(dispatch.flags)) return;

  if (await runClaimingChain(event, dispatch.editHandlers)) return;

  void dispatch.toolHandler(event);
}
