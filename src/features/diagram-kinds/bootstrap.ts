import { getDiagramKind, registerDiagramKind } from "./registry";
import { guidedKind } from "./guided/guided.kind";

/**
 * Registers the built-in diagram kinds. Idempotent: the app shell and tests may
 * both call it. With nothing registered the editor is today's freehand editor,
 * so this is the only line that turns kinds on.
 */
export function registerBuiltInDiagramKinds(): void {
  if (!getDiagramKind(guidedKind.id)) registerDiagramKind(guidedKind);
}
