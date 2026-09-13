import {
  claimShortcutEvent,
  isModKeyPressed,
  keyIs,
  keyIsOneOf,
  keyMatchesLetter,
  KEY,
} from "./helpers";

export interface CanvasKeydownModeFlags {
  isCompareMode: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  isFlowPanelOpen: boolean;
  isSearchOpen?: boolean;
  isCommandPaletteOpen?: boolean;
  isScenesDrawerOpen?: boolean;
}

/** True when edit/tool shortcuts must not run (flow, playback, compare, record). */
export function isCanvasEditingLocked(flags: CanvasKeydownModeFlags): boolean {
  return flags.isFlowPanelOpen || flags.isPlaying || flags.isCompareMode || flags.isRecording;
}

/** True when search or command palette owns the keyboard surface. */
export function isCanvasOverlayOpen(flags: CanvasKeydownModeFlags): boolean {
  return Boolean(flags.isSearchOpen || flags.isCommandPaletteOpen);
}

export function handleScenesDrawerKey(
  event: KeyboardEvent,
  flags: CanvasKeydownModeFlags,
  onCloseScenesDrawer?: () => void,
): boolean {
  if (!flags.isScenesDrawerOpen) return false;
  if (keyIs(event, KEY.ESCAPE)) {
    claimShortcutEvent(event);
    onCloseScenesDrawer?.();
  }
  return true;
}

export function handleSaveShortcut(
  event: KeyboardEvent,
  flags: CanvasKeydownModeFlags,
  forceSaveToFolder: () => void | Promise<void>,
): boolean {
  if (!isModKeyPressed(event) || !keyMatchesLetter(event, KEY.S)) return false;
  if (isCanvasEditingLocked(flags) || isCanvasOverlayOpen(flags)) return false;
  claimShortcutEvent(event);
  void forceSaveToFolder();
  return true;
}

export function handleAutoLayoutShortcut(
  event: KeyboardEvent,
  flags: CanvasKeydownModeFlags,
  onAutoLayout?: () => void,
): boolean {
  if (!isModKeyPressed(event) || !event.altKey || event.shiftKey) return false;
  if (!keyMatchesLetter(event, KEY.L)) return false;
  claimShortcutEvent(event);
  if (!isCanvasEditingLocked(flags)) {
    onAutoLayout?.();
  }
  return true;
}

/**
 * Compare mode: claim destructive / clipboard chords so they cannot mutate the
 * live diagram, and Esc exits compare (unless a reading is also playing).
 */
export function handleCompareModeKeys(
  event: KeyboardEvent,
  flags: CanvasKeydownModeFlags,
  setCompareScene: (sceneId: string | null) => void,
): boolean {
  if (!flags.isCompareMode) return false;

  if (keyIs(event, KEY.ESCAPE)) {
    claimShortcutEvent(event);
    if (!flags.isPlaying) setCompareScene(null);
    return true;
  }

  if (keyIsOneOf(event, [KEY.DELETE, KEY.BACKSPACE])) {
    claimShortcutEvent(event);
    return true;
  }

  if (
    isModKeyPressed(event) &&
    (keyMatchesLetter(event, KEY.V) ||
      keyMatchesLetter(event, KEY.D) ||
      keyMatchesLetter(event, KEY.C))
  ) {
    claimShortcutEvent(event);
    return true;
  }

  return false;
}
