import {
  applyDiagramAutoLayout,
  planDiagramAutoLayout,
} from "@/features/canvas/layout/autoLayoutDiagram";
import { isSharedRefComponent } from "@/features/diagram/model/component.guards";
import type { Diagram } from "@/features/diagram/model/diagram.types";
import {
  normalizeLayoutSettings,
  type DiagramLayoutSettings,
} from "@/features/diagram/model/layout-settings";
import { createDiagramStore } from "@/features/diagram/store/diagram.store";
import { InMemoryAdapter } from "@/infrastructure/persistence";

/**
 * Arranges a preview diagram the way the canvas arranges a diagram: the same plan
 * (`planDiagramAutoLayout`) — reading direction, sources first, density and gaps, automatic
 * references by the settings' rules — applied the same way, positions and references in one step
 * and then ELK's handle order and corridors. It runs in a throwaway in-memory store, never the
 * app's, and nothing is persisted.
 *
 * Connection ids are fixed before (`buildPreviewDiagram`), so a connection the arrangement moves
 * onto a reference keeps its id; only its end changes.
 */
export async function arrangePreviewDiagram(
  base: Diagram,
  settings?: DiagramLayoutSettings,
): Promise<Diagram> {
  const plan = await planDiagramAutoLayout({
    components: base.snapshot.components,
    connections: Object.values(base.snapshot.connections),
    nodeLayouts: base.nodeLayouts,
    autoRefs: true,
    ...(settings && { settings }),
    direction: base.direction ?? "LR",
  });
  if (plan.result.boxes.size === 0) return base;
  // Made after the plan, and written and read with no await in between: the store's
  // persistence hydrates asynchronously and must not land between the two.
  const store = createDiagramStore(new InMemoryAdapter());
  store.setState({ diagrams: { [base.id]: base }, activeDiagramId: base.id });
  applyDiagramAutoLayout(plan, base.id, { store });
  return store.getState().diagrams[base.id] ?? base;
}

/**
 * What an arrangement depends on: each component's id, parent, type and size, each connection's
 * id (ends, label, occurrence) and ends, and the settings. Two graphs with the same signature
 * arrange the same, so a text edit need not move anything.
 */
export function arrangeSignature(base: Diagram, settings?: DiagramLayoutSettings): string {
  const components = Object.values(base.snapshot.components)
    .map((c) => {
      const layout = base.nodeLayouts[c.id];
      return [c.id, c.parentId ?? "", c.type, layout?.width ?? "", layout?.height ?? ""].join("|");
    })
    .sort();
  const connections = Object.values(base.snapshot.connections)
    .map((c) => [c.id, c.sourceId, c.targetId].join("|"))
    .sort();
  return JSON.stringify([components, connections, normalizeLayoutSettings(settings) ?? {}]);
}

/**
 * The arranged picture with the text of a newer build of the same structure: every element
 * stays where it was. A component takes its new fields (an original keeps the `shared` mode its
 * references gave it), a reference its original's name, and a connection its new fields on the
 * ends the arrangement gave it.
 */
export function withContentOf(arranged: Diagram, fresh: Diagram): Diagram {
  const next = fresh.snapshot;
  const components: Diagram["snapshot"]["components"] = {};
  for (const [id, component] of Object.entries(arranged.snapshot.components)) {
    const updated = next.components[id];
    if (updated) {
      components[id] = component.shared ? { ...updated, shared: component.shared } : updated;
    } else if (isSharedRefComponent(component)) {
      const original = next.components[component.refOf];
      components[id] = original ? { ...component, name: original.name } : component;
    } else components[id] = component;
  }
  const connections: Diagram["snapshot"]["connections"] = {};
  for (const [id, connection] of Object.entries(arranged.snapshot.connections)) {
    const updated = next.connections[id];
    connections[id] = updated
      ? { ...updated, sourceId: connection.sourceId, targetId: connection.targetId }
      : connection;
  }
  return { ...arranged, snapshot: { ...arranged.snapshot, components, connections } };
}
