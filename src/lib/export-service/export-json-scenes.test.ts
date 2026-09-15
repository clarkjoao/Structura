import { describe, expect, it } from "vitest";
import type { Component, Diagram, SceneDiff } from "@/features/diagram";
import { resolveSceneSnapshot } from "@/features/diagram";
import { validateDiagramFile } from "@/infrastructure/persistence/validateWorkspaceFile";
import { exportJSON } from "./export-json";

/**
 * Scenes are diagram content: exportJSON must preserve them whether or not a
 * scene is active. Snapshot stays the base; SceneDiffs stay diffs over it.
 */

function baseComponent(id: string, name: string): Component {
  return {
    id,
    name,
    description: "",
    parentId: null,
    type: "system",
  };
}

function sceneDiff(overrides: Partial<SceneDiff> & Pick<SceneDiff, "id" | "name">): SceneDiff {
  return {
    color: "#6366f1",
    createdAt: 1,
    addedComponents: {},
    addedConnections: {},
    removedComponentIds: [],
    removedConnectionIds: [],
    nodeLayouts: {},
    ...overrides,
  };
}

function diagramWithScenes(activeSceneId: string | null | undefined): Diagram {
  const base: Component = baseComponent("base-1", "Base System");
  const sceneOnly: Component = baseComponent("scene-1", "Scene Only");
  const scene = sceneDiff({
    id: "sc1",
    name: "Future",
    addedComponents: { [sceneOnly.id]: sceneOnly },
    nodeLayouts: { [sceneOnly.id]: { elementId: sceneOnly.id, x: 100, y: 100 } },
  });

  return {
    id: "d1",
    name: "Scenes export",
    level: "context",
    createdAt: 1,
    updatedAt: 1,
    snapshot: {
      components: { [base.id]: base },
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: { [base.id]: { elementId: base.id, x: 0, y: 0 } },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: { [scene.id]: scene },
    ...(activeSceneId !== undefined ? { activeSceneId } : {}),
  };
}

describe("exportJSON — scenes as content", () => {
  it("preserves scenes when a scene is active (does not flatten/drop)", () => {
    const diagram = diagramWithScenes("sc1");
    const parsed = JSON.parse(exportJSON(diagram)) as {
      data: Diagram;
    };

    expect(parsed.data.scenes).toBeDefined();
    expect(Object.keys(parsed.data.scenes!)).toEqual(["sc1"]);
    expect(parsed.data.scenes!.sc1.addedComponents["scene-1"]?.name).toBe("Scene Only");
    expect(parsed.data.activeSceneId).toBe("sc1");
    // Base snapshot is not flattened — scene-only component stays out of base
    expect(parsed.data.snapshot.components["scene-1"]).toBeUndefined();
    expect(parsed.data.snapshot.components["base-1"]).toBeDefined();
  });

  it("preserves scenes when no scene is active", () => {
    const diagram = diagramWithScenes(null);
    const parsed = JSON.parse(exportJSON(diagram)) as { data: Diagram };

    expect(parsed.data.scenes).toBeDefined();
    expect(Object.keys(parsed.data.scenes!)).toEqual(["sc1"]);
    expect(parsed.data.activeSceneId).toBeNull();
  });

  it("round-trips: reimport recovers all scenes and active scene still resolves", () => {
    const diagram = diagramWithScenes("sc1");
    const json = exportJSON(diagram);
    const validation = validateDiagramFile(JSON.parse(json));
    expect(validation.valid).toBe(true);
    if (!validation.valid) return;

    const imported = validation.diagram;
    expect(imported.scenes).toBeDefined();
    expect(Object.keys(imported.scenes!)).toEqual(["sc1"]);
    expect(imported.activeSceneId).toBe("sc1");
    expect(imported.snapshot.components["base-1"]).toBeDefined();
    expect(imported.snapshot.components["scene-1"]).toBeUndefined();

    const resolved = resolveSceneSnapshot(imported, "sc1");
    expect(resolved.components["base-1"]).toBeDefined();
    expect(resolved.components["scene-1"]?.name).toBe("Scene Only");
  });
});
