/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host's src/lib/opscr-mapping, synced via `npm run sync-shared`.
 * Edit the host files and re-sync instead of changing this file.
 */

import type { PlacedView } from "./layout";

/**
 * The placed view in the shape of a plugin importer result (plugin API 1.3,
 * `PluginComponentInput` / `PluginConnectionInput`), restated structurally so this library
 * imports nothing from the plugin API. The opscr plugin returns it from its importer; the
 * VSCode extension posts it to the embed preview. Both then go through the host's
 * normalization, which writes `cloudServiceId` through `cloudServiceIdWrite()`.
 */
export interface ImporterGraphComponent {
  key: string;
  name: string;
  type: string;
  description: string;
  parentKey?: string;
  cloudServiceId?: string;
  technology?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface ImporterGraphConnection {
  source: string;
  target: string;
  label: string;
}

export interface ImporterGraph {
  components: ImporterGraphComponent[];
  connections: ImporterGraphConnection[];
}

/** Roots offset by `anchor`, children relative to their panel; connections labelled by edge type. */
export function toImporterGraph(view: PlacedView, anchor = { x: 0, y: 0 }): ImporterGraph {
  const components = view.nodes.map((node): ImporterGraphComponent => {
    const isRoot = node.parentId === null;
    // The importer API's field name; the host writes the persisted field on insert.
    const { type, catalogServiceId: cloudServiceId, technology } = node.element;
    return {
      key: node.id,
      name: node.name,
      type,
      description: node.description,
      ...(node.parentId !== null ? { parentKey: node.parentId } : {}),
      ...(cloudServiceId !== undefined ? { cloudServiceId } : {}),
      ...(technology !== undefined ? { technology } : {}),
      x: node.box.x + (isRoot ? anchor.x : 0),
      y: node.box.y + (isRoot ? anchor.y : 0),
      // Panels take the size that holds their children; leaves keep their intrinsic size.
      ...(node.isBoundary ? { width: node.box.width, height: node.box.height } : {}),
    };
  });
  const connections = view.edges.map((edge) => ({
    source: edge.sourceId,
    target: edge.targetId,
    label: edge.type,
  }));
  return { components, connections };
}
