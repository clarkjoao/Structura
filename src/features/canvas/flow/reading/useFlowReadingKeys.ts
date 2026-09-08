import { useEffect } from "react";
import { KEY, keyIs } from "@/lib/keyboard-utils";

interface Params {
  /** True while a script is being read; nothing is bound otherwise. */
  isReading: boolean;
  /** At a branch point the way forward is a choice, so the key does not pick one. */
  isCondition: boolean;
  onGoNext: () => void;
  onGoBack: () => void;
  onExit: () => void;
  onStepOver?: () => void;
  onStepOut?: () => void;
}

/**
 * The keys a reading answers to.
 *
 * Arrows walk it, Escape closes it, and — because the reading borrows the
 * whole shape of a debugger — F10 steps over a call and Shift+F11 steps out of
 * one. F11 alone is left to the browser: it is fullscreen, and going forward
 * already has two keys.
 *
 * The rule lived in the workspace page, which is why a shared diagram could be
 * read only by clicking: the viewer runs the same playback machine and had no
 * way to reach it.
 */
export function useFlowReadingKeys({
  isReading,
  isCondition,
  onGoNext,
  onGoBack,
  onExit,
  onStepOver,
  onStepOut,
}: Params): void {
  useEffect(() => {
    if (!isReading) return;

    const handler = (event: KeyboardEvent) => {
      if (keyIs(event, KEY.ESCAPE)) {
        event.preventDefault();
        onExit();
        return;
      }
      if (keyIs(event, KEY.ARROW_LEFT)) {
        event.preventDefault();
        onGoBack();
        return;
      }
      if (keyIs(event, KEY.ARROW_RIGHT)) {
        event.preventDefault();
        if (!isCondition) onGoNext();
        return;
      }
      if (keyIs(event, KEY.F10)) {
        event.preventDefault();
        onStepOver?.();
        return;
      }
      if (keyIs(event, KEY.F11) && event.shiftKey) {
        event.preventDefault();
        onStepOut?.();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isReading, isCondition, onGoNext, onGoBack, onExit, onStepOver, onStepOut]);
}
