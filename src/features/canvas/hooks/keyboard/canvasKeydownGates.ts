import {
  claimShortcutEvent,
  isModKeyPressed,
  keyIs,
  keyIsOneOf,
  keyMatchesLetter,
  keyMatchesLetterOrCode,
  KEY,
} from "./helpers";

export interface CanvasKeydownModeFlags {
  isCompareMode: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  isFlowPanelOpen: boolean;
  isSearchOpen?: boolean;
  isCommandPaletteOpen?: boolean;
  isVersionsDrawerOpen?: boolean;
}

/** True when edit/tool shortcuts must not run (flow, playback, compare, record). */
export function isCanvasEditingLocked(flags: CanvasKeydownModeFlags): boolean {
  return flags.isFlowPanelOpen || flags.isPlaying || flags.isCompareMode || flags.isRecording;
}

/**
 * True when search, the command palette, the element catalog or quick insert
 * owns the keyboard surface. The last two mark themselves in the DOM
 * (`data-canvas-overlay="open"`) instead of a flag, so opening them does not
 * re-render the canvas that computes these flags.
 */
export function isCanvasOverlayOpen(flags: CanvasKeydownModeFlags): boolean {
  return Boolean(flags.isSearchOpen || flags.isCommandPaletteOpen) || isCanvasOverlayLayerOpen();
}

export function isCanvasOverlayLayerOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector('[data-canvas-overlay="open"]') !== null;
}

export function handleVersionsDrawerKey(
  event: KeyboardEvent,
  flags: CanvasKeydownModeFlags,
  onCloseVersionsDrawer?: () => void,
): boolean {
  if (!flags.isVersionsDrawerOpen) return false;
  if (keyIs(event, KEY.ESCAPE)) {
    claimShortcutEvent(event);
    onCloseVersionsDrawer?.();
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

/**
 * Auto layout: Cmd/Ctrl+Shift+L.
 *
 * Plain Cmd+L is Chrome's address bar; Cmd+Alt+L remaps `event.key` on macOS
 * (Option produces symbols). Shift+L avoids both; match via code as well.
 */
export function handleAutoLayoutShortcut(
  event: KeyboardEvent,
  flags: CanvasKeydownModeFlags,
  onAutoLayout?: () => void,
): boolean {
  if (!isModKeyPressed(event) || !event.shiftKey || event.altKey) return false;
  if (!keyMatchesLetterOrCode(event, KEY.L, "KeyL")) return false;
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
  setCompareVersion: (versionId: string | null) => void,
): boolean {
  if (!flags.isCompareMode) return false;

  if (keyIs(event, KEY.ESCAPE)) {
    claimShortcutEvent(event);
    if (!flags.isPlaying) setCompareVersion(null);
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
