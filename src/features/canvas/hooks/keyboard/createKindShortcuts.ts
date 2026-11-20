import { toast } from "sonner";
import type { Diagram, DiagramModel } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { kindCommandContextFor, resolveKindText } from "@/features/diagram-kinds/context";
import { isKindActive, resolveKindPolicy } from "@/features/diagram-kinds/policy";
import type { KindCommand, KindCommandOutcome } from "@/features/diagram-kinds/kind.types";
import type { KeyHandler } from "./helpers";

/** The chord an event spells, in the notation kind commands declare (`Shift+Tab`, `Alt+ArrowUp`). */
export function chordOf(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "altKey" | "ctrlKey" | "metaKey">,
): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.metaKey) parts.push("Meta");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(event.key);
  return parts.join("+");
}

export interface KindShortcutsDeps {
  getDiagram: () => Diagram | DiagramModel | null | undefined;
  getSelectedIds: () => readonly string[];
  select: (id: string) => void;
  /** Opens label editing on the selected element (the inspector's title). */
  requestEditLabel: () => void;
}

/** Applies a command's outcome as one undo step; selects and edits what it names. */
export function applyKindCommandOutcome(
  outcome: KindCommandOutcome,
  deps: KindShortcutsDeps,
): void {
  const result = useDiagramStore.getState().applyKindEdit(outcome.edit);
  if (!outcome.select) return;
  const id = result.idsByKey[outcome.select] ?? outcome.select;
  deps.select(id);
  // After the selection settled: the title focus request resets on a selection change.
  if (outcome.editLabel) setTimeout(deps.requestEditLabel, 0);
}

/** Runs `command` on the current selection; true when it ran (or refused with a notice). */
function runKindCommand(command: KindCommand, deps: KindShortcutsDeps): boolean {
  const diagram = deps.getDiagram();
  if (!diagram) return false;
  const ctx = kindCommandContextFor(diagram, deps.getSelectedIds());
  if (!command.enabled(ctx)) return false;
  const outcome = command.run(ctx);
  if ("refused" in outcome) {
    toast.info(resolveKindText(outcome.refused));
    return true;
  }
  applyKindCommandOutcome(outcome, deps);
  return true;
}

/**
 * The keyboard of a diagram kind's own editor (ADR-0014): the kind's commands
 * bound to their chords, only while the diagram is in its kind's mode. Placed
 * first in the canvas edit chain, so `Tab` and `Delete` mean the kind's
 * gestures there; with nothing the kind can act on selected the event falls
 * through, and `Tab` moves focus as usual.
 */
export function createKindShortcuts(deps: KindShortcutsDeps): KeyHandler {
  return (event) => {
    const policy = resolveKindPolicy(deps.getDiagram());
    if (!isKindActive(policy)) return false;
    const chord = chordOf(event);
    const command = policy.descriptor.commands?.find((c) => c.keys?.includes(chord));
    if (!command) return false;
    return runKindCommand(command, deps);
  };
}
