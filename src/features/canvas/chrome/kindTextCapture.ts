import { toast } from "sonner";
import i18n from "@/infrastructure/i18n/i18n";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { kindCommandContextFor, resolveKindText } from "@/features/diagram-kinds/context";
import type { KindTextBuild, KindTextError, KindText } from "@/features/diagram-kinds/kind.types";
import { kindTextCaptureFor } from "@/features/diagram-kinds/textCapture";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { applyKindCommandOutcome } from "../hooks/keyboard/createKindShortcuts";
import { canvasSelectionDeps } from "./kindElementActions";

export type KindTextResult = KindTextBuild | { refused: KindText } | { errors: KindTextError[] };

function activeDiagram() {
  const state = useDiagramStore.getState();
  return state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
}

const selectedIds = () => [...useCanvasSelectionStore.getState().selectedNodeIds];

/** What `text` would add to the active diagram after the canvas selection; null without capture. */
export function buildKindText(text: string): KindTextResult | null {
  const diagram = activeDiagram();
  const capture = kindTextCaptureFor(diagram);
  if (!diagram || !capture) return null;
  return capture.build(kindCommandContextFor(diagram, selectedIds()), text);
}

/**
 * The active diagram written as text by its kind, in `formatId` (one of the
 * capture's `formats`; the default format when absent); null without capture.
 */
export function serializeKindText(formatId?: string): string | null {
  const diagram = activeDiagram();
  const capture = kindTextCaptureFor(diagram);
  if (!diagram || !capture) return null;
  const format = formatId ? capture.formats?.find((f) => f.id === formatId) : undefined;
  return (format?.serialize ?? capture.serialize)(diagram, kindCommandContextFor(diagram, []));
}

/**
 * Adds a built text to the active diagram as one undo step and selects what it
 * names last (spec guided-journey-outline). A refusal shows its notice.
 */
export function applyKindTextBuild(
  built: KindTextResult,
  options: { undoNotice?: boolean } = {},
): boolean {
  if ("errors" in built) return false;
  if ("refused" in built) {
    toast.info(resolveKindText(built.refused));
    return false;
  }
  if (built.nodeCount === 0 && !built.edit.add?.length) return false;
  applyKindCommandOutcome(built, canvasSelectionDeps);
  if (options.undoNotice) {
    toast.success(i18n.t("diagramKinds.guided.outline.added", { count: built.nodeCount }), {
      action: {
        label: i18n.t("diagramKinds.guided.outline.undo"),
        onClick: () => useDiagramStore.getState().undo(),
      },
    });
  }
  return true;
}

/**
 * A canvas paste of plain text: taken as the kind's text when it reads without
 * errors and adds at least two elements; otherwise left to the usual paste.
 */
export function pasteKindText(text: string): boolean {
  // Markup and data (the drawio XML a canvas copy writes, JSON) are never an outline.
  if (!text.trim() || /^\s*[<{[]/.test(text)) return false;
  const built = buildKindText(text);
  if (!built || "errors" in built) return false;
  if ("nodeCount" in built && built.nodeCount < 2) return false;
  return applyKindTextBuild(built, { undoNotice: true }) || "refused" in built;
}
