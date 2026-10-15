import type { Component, Diagram, DiagramModel, VersionDiff } from "../model/diagram.types";
import { isTextType } from "../model/component-type-constants";

type TextHideable = Diagram | DiagramModel;

function dropTexts<T>(
  components: Record<string, Component>,
  layouts: Record<string, T>,
): { components: Record<string, Component>; layouts: Record<string, T> } {
  const textIds = Object.values(components)
    .filter((component) => isTextType(component.type))
    .map((component) => component.id);
  if (textIds.length === 0) return { components, layouts };
  const gone = new Set(textIds);
  return {
    components: Object.fromEntries(Object.entries(components).filter(([id]) => !gone.has(id))),
    layouts: Object.fromEntries(Object.entries(layouts).filter(([id]) => !gone.has(id))),
  };
}

/**
 * The diagram as a surface outside the editor should see it: with the text
 * layer off, the texts are not part of it — not drawn, not exported, and not
 * carried in a share link, where they would stay readable inside the payload
 * even though nothing draws them.
 *
 * With the layer on the diagram is returned as is. The native JSON export does
 * not use this: it is the lossless copy, and keeps the texts and the flag.
 */
export function withoutHiddenTexts<T extends TextHideable>(diagram: T): T {
  if (diagram.textsVisible === true) return diagram;

  const base = dropTexts(diagram.snapshot.components, diagram.nodeLayouts);
  let changed = base.components !== diagram.snapshot.components;

  let versions: Record<string, VersionDiff> | undefined = diagram.versions;
  if (diagram.versions) {
    versions = Object.fromEntries(
      Object.entries(diagram.versions).map(([id, scene]) => {
        const added = dropTexts(scene.addedComponents, scene.nodeLayouts);
        if (added.components === scene.addedComponents) return [id, scene];
        changed = true;
        return [
          id,
          { ...scene, addedComponents: added.components, nodeLayouts: added.layouts },
        ] as const;
      }),
    );
  }

  if (!changed) return diagram;
  return {
    ...diagram,
    snapshot: { ...diagram.snapshot, components: base.components },
    nodeLayouts: base.layouts,
    ...(versions ? { versions } : {}),
  };
}
