import { useEffect } from "react";
import { isEditableTarget, keyMatchesLetter } from "@/lib/core/keyboard";

/**
 * Cmd/Ctrl+A selects everything on screen instead of the page's text.
 *
 * Stays out of the way while the user types, and while a dialog is open — there
 * Cmd+A belongs to whatever the dialog is doing.
 */
export function useSelectAllShortcut(onSelectAll: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (!keyMatchesLetter(event, "a")) return;
      if (isEditableTarget(event.target)) return;
      if (document.querySelector("[role='dialog'],[role='alertdialog']")) return;

      event.preventDefault();
      onSelectAll();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSelectAll, enabled]);
}
