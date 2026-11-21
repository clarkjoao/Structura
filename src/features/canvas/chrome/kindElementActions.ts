import { toast } from "sonner";
import type { Diagram, DiagramModel } from "@/features/diagram";
import { kindCommandContextFor, resolveKindText } from "@/features/diagram-kinds/context";
import { isKindActive, resolveKindPolicy } from "@/features/diagram-kinds/policy";
import type {
  KindActionGlyph,
  KindCommandOutcome,
  KindText,
} from "@/features/diagram-kinds/kind.types";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { applyKindCommandOutcome } from "../hooks/keyboard/createKindShortcuts";

/** One entry a kind adds to an element's menu or inspector. */
export interface KindMenuItem {
  id: string;
  label: string;
  group: string;
  danger?: boolean;
  glyph?: KindActionGlyph;
  shortcut?: string;
  onSelect: () => void;
}

export const canvasSelectionDeps = {
  getDiagram: () => null,
  getSelectedIds: () => [...useCanvasSelectionStore.getState().selectedNodeIds],
  select: (id: string) => {
    const selection = useCanvasSelectionStore.getState();
    selection.setSelectedEdgeId(null);
    selection.setSelectedNodeIds(new Set([id]));
    selection.setSelectedNodeId(id);
  },
  requestEditLabel: () => {},
};

function runOutcome(outcome: KindCommandOutcome | { refused: KindText }): void {
  if ("refused" in outcome) {
    toast.info(resolveKindText(outcome.refused));
    return;
  }
  applyKindCommandOutcome(outcome, canvasSelectionDeps);
}

/**
 * What the active kind offers on `elementId` (ADR-0014): its context-menu
 * commands that apply to the selection, then its element actions. Empty on a
 * freehand diagram and on a kind diagram edited freehand.
 */
export function kindMenuItemsFor(
  diagram: Diagram | DiagramModel,
  elementId: string,
  selectedIds: readonly string[],
): KindMenuItem[] {
  const policy = resolveKindPolicy(diagram);
  if (!isKindActive(policy)) return [];
  const ctx = kindCommandContextFor(diagram, selectedIds.length > 0 ? selectedIds : [elementId]);
  const items: KindMenuItem[] = [];
  for (const command of policy.descriptor.commands ?? []) {
    if (!command.contextMenu || !command.enabled(ctx)) continue;
    items.push({
      id: command.id,
      group: "commands",
      label: resolveKindText(command.label),
      ...(command.keys?.[0] && { shortcut: command.keys[0] }),
      onSelect: () => runOutcome(command.run(ctx)),
    });
  }
  for (const action of policy.descriptor.elementActions?.(ctx, elementId) ?? []) {
    items.push({
      id: action.id,
      group: action.group,
      label: resolveKindText(action.label, action.values),
      ...(action.danger && { danger: true }),
      ...(action.glyph && { glyph: action.glyph }),
      onSelect: () => runOutcome(action.run()),
    });
  }
  return items;
}

/** Only the element actions (the inspector shows the commands' shortcuts elsewhere). */
export function kindElementActionItems(
  diagram: Diagram | DiagramModel,
  elementId: string,
): KindMenuItem[] {
  return kindMenuItemsFor(diagram, elementId, [elementId]).filter(
    (item) => item.group !== "commands",
  );
}
