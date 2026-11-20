import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import type { Diagram } from "@/features/diagram/model/diagram.types";
import type { KindEdit } from "@/features/diagram/model/kind-edit.types";
import { kindContextFor } from "../context";
import { guidedKind } from "./guided.kind";
import { arrangeGuidedSync } from "./guided.arrange";
import { readGuided } from "./guided.model";

/**
 * A guided diagram in a test store, edited the way the canvas edits it: a
 * gesture's change set (one undo step), then the kind's derivation and
 * arrangement without history (what the kind watcher does).
 */
export function guidedHarness(direction?: "TB") {
  const store = createTestDiagramStore();
  const created = store
    .getState()
    .addDiagram("Checkout", "context", undefined, null, undefined, { kind: guidedKind.id });
  store.getState().openDiagram(created.id);
  const diagramId = created.id;
  if (direction)
    store.setState((s) => ({
      diagrams: { ...s.diagrams, [diagramId]: { ...s.diagrams[diagramId]!, direction } },
    }));

  const diagram = (): Diagram => store.getState().diagrams[diagramId]!;
  const settle = (): void => {
    const derived = guidedKind.derive!(diagram(), kindContextFor(diagram()));
    if (derived) store.getState().applyKindEdit(derived, { history: false });
    const { layouts } = arrangeGuidedSync(diagram(), {
      measured: {},
      gaps: { layer: 96, node: 32 },
    });
    if (layouts.length > 0)
      store.getState().applyAutoLayout(layouts, undefined, { history: false });
  };
  const apply = (edit: KindEdit) => {
    // Leave the undo cooldown behind so the edit gets its own checkpoint.
    store.setState({ _lastUndoRedoTimestamp: 0 });
    const result = store.getState().applyKindEdit(edit);
    settle();
    return result;
  };

  const template = guidedKind.create!(kindContextFor(diagram()));
  const createdIds = store.getState().applyKindEdit(template.edit, { history: false });
  settle();
  const startId = createdIds.idsByKey.start!;
  const laneIds = [createdIds.idsByKey["lane-1"]!, createdIds.idsByKey["lane-2"]!];

  /** Runs a guided command on `selected`; returns the id it selects, or throws on a refusal. */
  const run = (commandId: string, selected: string[]): string | undefined => {
    const command = guidedKind.commands!.find((c) => c.id === commandId)!;
    const ctx = { ...kindContextFor(diagram()), diagram: diagram(), selectedIds: selected };
    const outcome = command.run(ctx);
    if ("refused" in outcome) throw new Error(`refused: ${JSON.stringify(outcome.refused)}`);
    const result = apply(outcome.edit);
    return outcome.select ? (result.idsByKey[outcome.select] ?? outcome.select) : undefined;
  };
  const refusalOf = (commandId: string, selected: string[]) => {
    const command = guidedKind.commands!.find((c) => c.id === commandId)!;
    const outcome = command.run({
      ...kindContextFor(diagram()),
      diagram: diagram(),
      selectedIds: selected,
    });
    return "refused" in outcome ? outcome.refused : null;
  };

  const rename = (id: string, name: string) => apply({ update: [{ id, name }] });
  const label = (connectionId: string, text: string) =>
    apply({ relabel: [{ id: connectionId, label: text }] });
  const reading = () => readGuided(diagram());
  const flow = () => {
    const id = diagram().kindData?.flowId;
    return typeof id === "string" ? diagram().snapshot.flows[id] : undefined;
  };
  const nameOf = (id: string) => diagram().snapshot.components[id]?.name;
  /** The sequence of step names along `next` from the entry (first branch at conditions). */
  const sequence = (): string[] => {
    const f = flow();
    const out: string[] = [];
    let id = f?.entryStepId;
    const seen = new Set<string>();
    while (id && f && !seen.has(id)) {
      seen.add(id);
      const step = f.steps[id]!;
      // Steps on a connection travelled sit between journey steps: the sequence names the steps.
      if (step.componentId) out.push(nameOf(step.componentId) ?? "?");
      id = step.next ?? step.branches?.[0]?.nextId;
    }
    return out;
  };
  const absolute = (id: string) => {
    const d = diagram();
    const layout = d.nodeLayouts[id]!;
    const parent = d.snapshot.components[id]!.parentId;
    const p = parent ? d.nodeLayouts[parent]! : { x: 0, y: 0 };
    return {
      x: p.x + layout.x,
      y: p.y + layout.y,
      width: layout.width ?? 0,
      height: layout.height ?? 0,
    };
  };

  return {
    store,
    diagramId,
    diagram,
    startId,
    laneIds,
    run,
    refusalOf,
    apply,
    rename,
    label,
    reading,
    flow,
    sequence,
    nameOf,
    absolute,
    settle,
  };
}
