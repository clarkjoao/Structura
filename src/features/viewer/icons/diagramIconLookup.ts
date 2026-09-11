import type { Diagram, IconDefinition } from "@/features/diagram/model";
import { resolveSceneSnapshot } from "@/features/diagram/utils";

export type DiagramIconLookup = (componentId: string) => IconDefinition | null;

/**
 * Resolve a component's custom icon from the diagram in the URL, not the
 * workspace icon store. Share/embed must not pick up the host's library.
 *
 * @example
 * const lookup = iconLookupForDiagram(diagram);
 * lookup("n1"); // IconDefinition | null
 */
export function iconLookupForDiagram(diagram: Diagram): DiagramIconLookup {
  const components = resolveSceneSnapshot(diagram, null).components;
  const library = diagram.snapshot.iconLibrary ?? {};
  return (componentId: string): IconDefinition | null => {
    const iconId = components[componentId]?.customIconId;
    if (!iconId) return null;
    return library[iconId] ?? null;
  };
}
