import type { Diagram } from "@/features/diagram";
import { sanitizeComponentType } from "@/features/diagram";
import type { Component } from "@/features/diagram/model/component.types";
import type { Connection } from "@/features/diagram/model/connection.types";
import { migrateConnectionsSemantics } from "@/features/diagram/utils/connection-semantics-migration";
import { DIAGRAM_SCHEMA_VERSION } from "./versions";

/**
 * Migration functions for diagram schema changes.
 * Each function transforms a diagram from an older schema version to a newer one.
 * Migrations are applied sequentially based on the fromVersion.
 */

/**
 * Migrate a diagram from an older schema version to the current one.
 * Migrations are applied sequentially based on the fromVersion.
 */
export function migrateDiagram(diagram: Diagram, fromVersion: number): Diagram {
  let current = { ...diagram };

  // Always-run sanitisation: repair corrupted `type` strings that
  // slipped into stored components via earlier template-save cycles
  // (e.g. "API Endpoints /api/v1 · REST"). These don't belong to any
  // registered element or plugin namespace, so they land on `"unknown"`
  // (F9 / decision 4). The string here acts as a *floor* — older
  // diagrams still pass through, and the sanitiser is a no-op for
  // diagrams that already have valid types.
  current = sanitizeCorruptedComponentTypes(current);
  current = migrateConnectionSemanticsInDiagram(current);

  if (fromVersion >= DIAGRAM_SCHEMA_VERSION) {
    return current;
  }

  if (fromVersion < 1) {
    current = migrateV0toV1(current);
  }

  return current;
}

const LEGACY_CONNECTION_FIELDS = ["intent", "transportPreset", "communicationType"] as const;

function hasLegacyConnectionSemantics(
  connections: Record<string, Connection> | undefined,
): boolean {
  return Object.values(connections ?? {}).some(
    (conn) =>
      conn.direction === "reverse" ||
      LEGACY_CONNECTION_FIELDS.some((field) => conn[field] !== undefined),
  );
}

/**
 * A diagram file saved before schema v16 still speaks intent / transport / reverse: bring its
 * connections to interaction × kind, as the local store does on load. Always runs; a diagram that
 * is already current is returned as it came, and one that is not is cloned first so the caller's
 * object is never mutated.
 */
function migrateConnectionSemanticsInDiagram(diagram: Diagram): Diagram {
  const versions = Object.values(diagram.versions ?? {});
  const needs =
    hasLegacyConnectionSemantics(diagram.snapshot?.connections) ||
    versions.some((scene) => hasLegacyConnectionSemantics(scene.addedConnections));
  if (!needs) return diagram;
  const next = structuredClone(diagram);
  migrateConnectionsSemantics({
    components: next.snapshot.components ?? {},
    connections: next.snapshot.connections ?? {},
    edgeLayouts: next.edgeLayouts,
  });
  for (const scene of Object.values(next.versions ?? {})) {
    migrateConnectionsSemantics({
      components: { ...(next.snapshot.components ?? {}), ...(scene.addedComponents ?? {}) },
      connections: scene.addedConnections ?? {},
      edgeLayouts: next.edgeLayouts,
    });
  }
  return next;
}

/**
 * Walk every component in `snapshot.components` and in any active scene's
 * `addedComponents`, normalising the `type` field through
 * `sanitizeComponentType`. No-op for components with a valid type.
 */
function sanitizeCorruptedComponentTypes(diagram: Diagram): Diagram {
  const cleanMap = (
    source: Record<string, Component> | undefined,
  ): Record<string, Component> | undefined => {
    if (!source) return source;
    let dirty = false;
    const next: Record<string, Component> = {};
    for (const [id, comp] of Object.entries(source)) {
      if (comp && comp.type !== sanitizeComponentType(comp.type)) {
        next[id] = { ...comp, type: sanitizeComponentType(comp.type) } as Component;
        dirty = true;
      } else {
        next[id] = comp;
      }
    }
    return dirty ? next : source;
  };

  const components = cleanMap(diagram.snapshot?.components);
  if (!components) return diagram;

  let nextDiagram: Diagram = {
    ...diagram,
    snapshot: { ...diagram.snapshot, components },
  };

  // Active scene's added components may also carry corrupted types.
  if (diagram.activeVersionId && diagram.versions?.[diagram.activeVersionId]) {
    const scene = diagram.versions[diagram.activeVersionId];
    const sceneComponents = cleanMap(scene.addedComponents);
    if (sceneComponents) {
      nextDiagram = {
        ...nextDiagram,
        versions: {
          ...nextDiagram.versions,
          [diagram.activeVersionId]: { ...scene, addedComponents: sceneComponents },
        },
      };
    }
  }

  return nextDiagram;
}

/**
 * Migrate from V0 (pre-versioning) to V1.
 * This ensures diagrams have consistent structure for future migrations.
 */
function migrateV0toV1(diagram: Diagram): Diagram {
  return {
    ...diagram,
    // V1 is the baseline versioned format
    // Add any transformations needed for legacy diagrams here
  };
}

// Re-export for convenience
export { migrateDiagram as default };
