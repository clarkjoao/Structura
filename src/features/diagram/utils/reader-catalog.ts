import type { Component, Diagram } from "../model";
import { isExternalElementComponent } from "../model/component.guards";

/** Something a node shows by name only. */
export interface NamedRef {
  name: string;
}

/**
 * The names a diagram shows but does not hold.
 *
 * A card draws its service's name and the name of the diagram it links to.
 * Neither is part of the diagram: they live in the workspace, next to it. The
 * editor reads them from the store; a reader of a shared link is on another
 * machine, where those ids mean nothing — and a card missing two rows is a
 * shorter, narrower card, so every waypoint the layout anchored against the
 * real one misses (docs/investigation/paridade-editor-viewer-caixa-do-no.md).
 *
 * So the names travel with the diagram, as data: the share link carries them,
 * and a reader on the author's own machine builds them from the store. Only the
 * ids the diagram references, and only their names — never the rest of the
 * workspace.
 */
export interface ReaderCatalog {
  services: Readonly<Record<string, NamedRef>>;
  diagrams: Readonly<Record<string, NamedRef>>;
}

export const EMPTY_READER_CATALOG: ReaderCatalog = Object.freeze({
  services: Object.freeze({}),
  diagrams: Object.freeze({}),
});

/** The diagram a component points at by name: an external element's reference, or a drill-down. */
export function linkedDiagramIdOf(component: Component): string | undefined {
  return isExternalElementComponent(component)
    ? component.referenceDiagramId
    : component.linkedDiagramId;
}

/** Every component a reader can be shown: the base, and every scene's additions. */
function everyComponent(diagram: Diagram): Component[] {
  const scenes = Object.values(diagram.versions ?? {});
  return [
    ...Object.values(diagram.snapshot.components),
    ...scenes.flatMap((scene) => Object.values(scene.addedComponents ?? {})),
  ];
}

/**
 * The names `diagram` references, picked out of the workspace.
 *
 * @example
 * const catalog = buildReaderCatalog(diagram, state.services, state.diagrams);
 */
export function buildReaderCatalog(
  diagram: Diagram,
  services: Readonly<Record<string, NamedRef>>,
  diagrams: Readonly<Record<string, NamedRef>>,
): ReaderCatalog {
  const serviceNames: Record<string, NamedRef> = {};
  const diagramNames: Record<string, NamedRef> = {};
  for (const component of everyComponent(diagram)) {
    const service = component.serviceId ? services[component.serviceId] : undefined;
    if (component.serviceId && service) serviceNames[component.serviceId] = { name: service.name };
    const linkedId = linkedDiagramIdOf(component);
    const linked = linkedId ? diagrams[linkedId] : undefined;
    if (linkedId && linked) diagramNames[linkedId] = { name: linked.name };
  }
  return { services: serviceNames, diagrams: diagramNames };
}

function namesFrom(value: unknown): Record<string, NamedRef> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, NamedRef> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (entry && typeof entry === "object" && "name" in entry && typeof entry.name === "string") {
      out[id] = { name: entry.name };
    }
  }
  return out;
}

/**
 * A catalog read off a payload someone else wrote — a link, or an embedding
 * page's message. Anything that is not a name is dropped; a payload without a
 * catalog (every link written before this existed) reads as empty.
 */
export function readerCatalogFrom(value: unknown): ReaderCatalog {
  if (!value || typeof value !== "object") return EMPTY_READER_CATALOG;
  const record = value as Record<string, unknown>;
  return { services: namesFrom(record.services), diagrams: namesFrom(record.diagrams) };
}
