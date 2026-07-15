import type { Diagram } from "@/features/diagram";
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
  if (fromVersion >= DIAGRAM_SCHEMA_VERSION) {
    return diagram;
  }

  let current = { ...diagram };

  // V0 -> V1: Initial versioned format
  // No structural changes needed for V0 -> V1 as it was the baseline
  if (fromVersion < 1) {
    current = migrateV0toV1(current);
  }

  // Future migrations go here:
  // if (fromVersion < 2) {
  //   current = migrateV1toV2(current);
  // }

  return current;
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
