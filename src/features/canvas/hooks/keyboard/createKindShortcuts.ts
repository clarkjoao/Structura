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
  /** Selects a connection (an outcome's `selectConnection`). */
  selectConnection?: (id: string) => void;
  /** Opens label editing (the inspector's title) on `id` once it is the selection. */
  requestEditLabel: (id: string) => void;
}

/** Applies a command's outcome as one undo step; selects and edits what it names. */
export function applyKindCommandOutcome(
  outcome: KindCommandOutcome,
  deps: KindShortcutsDeps,
  onEditLabel?: () => void,
): void {
  const result = useDiagramStore.getState().applyKindEdit(outcome.edit);
  let selected: string;
  if (outcome.selectConnection && deps.selectConnection) {
    selected = outcome.selectConnection;
    deps.selectConnection(selected);
  } else if (outcome.select) {
    selected = result.idsByKey[outcome.select] ?? outcome.select;
    deps.select(selected);
  } else {
    return;
  }
  if (!outcome.editLabel) return;
  onEditLabel?.();
  // Named, so the request survives the selection change it follows.
  deps.requestEditLabel(selected);
}

/** Runs `command` on the current selection; true when it ran (or refused with a notice). */
function runKindCommand(
  command: KindCommand,
  deps: KindShortcutsDeps,
  onEditLabel?: () => void,
): boolean {
  const diagram = deps.getDiagram();
  if (!diagram) return false;
  const ctx = kindCommandContextFor(diagram, deps.getSelectedIds());
  if (!command.enabled(ctx)) return false;
  const outcome = command.run(ctx);
  if ("refused" in outcome) {
    toast.info(resolveKindText(outcome.refused));
    return true;
  }
  applyKindCommandOutcome(outcome, deps, onEditLabel);
  return true;
}

/** The name field a kind gesture opens: the element panel's title (`CommitField` marks it). */
function isPanelTitle(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && target.dataset.panelTitle !== undefined;
}

export interface KindShortcuts {
  /** The kind's chords on the canvas; placed first in the edit chain. */
  handler: KeyHandler;
  /**
   * The kind's chords from the name field a kind gesture just opened, so
   * "type the name, Tab, type the next" chains: the field is let go (which
   * commits the name) and the gesture runs on the step it named. Runs before
   * the canvas yields to focused fields; any other field keeps its keys.
   */
  fromLabelField: KeyHandler;
}

/**
 * The keyboard of a diagram kind's own editor (ADR-0014): the kind's commands
 * bound to their chords, only while the diagram is in its kind's mode. Placed
 * first in the canvas edit chain, so `Tab` and `Delete` mean the kind's
 * gestures there; with nothing the kind can act on selected the event falls
 * through, and `Tab` moves focus as usual.
 */
export function createKindShortcuts(deps: KindShortcutsDeps): KindShortcuts {
  // Armed when a gesture opens the name field, spent by the next key from it.
  let labelFieldArmed = false;
  const arm = () => {
    labelFieldArmed = true;
  };
  const commandFor = (event: KeyboardEvent): KindCommand | null => {
    const policy = resolveKindPolicy(deps.getDiagram());
    if (!isKindActive(policy)) return null;
    const chord = chordOf(event);
    return policy.descriptor.commands?.find((c) => c.keys?.includes(chord)) ?? null;
  };

  const handler: KeyHandler = (event) => {
    labelFieldArmed = false;
    const command = commandFor(event);
    return command ? runKindCommand(command, deps, arm) : false;
  };

  const fromLabelField: KeyHandler = (event) => {
    if (!labelFieldArmed || !isPanelTitle(event.target)) return false;
    const command = commandFor(event);
    if (!command) return false;
    labelFieldArmed = false;
    event.preventDefault();
    event.target.blur();
    return runKindCommand(command, deps, arm);
  };

  return { handler, fromLabelField };
}
