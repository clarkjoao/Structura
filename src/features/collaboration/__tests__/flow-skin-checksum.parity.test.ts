import { describe, expect, it } from "vitest";
import { snapshotChecksum } from "@/features/collaboration/utils/snapshotChecksum";
import type { Component, Connection } from "@/features/diagram";
import { getElement } from "@/features/elements/element.registry";
import "@/features/elements/bootstrap";
import { buildConnectionCountPerNode } from "@/features/canvas/edges/connectionDerivations";
import { emptyNodeBuildContext } from "@/features/elements/node-build-context.fixture";

/**
 * The flowchart skin adds an accent, a fill, a stroke and vertical edge sides —
 * all optional, all resolved at render and never written as defaults. A diagram
 * nobody edited therefore has to hash exactly as it did before the skin.
 *
 * `LEGACY_HASH` was computed on `main` at 48eaebd, before any of this existed,
 * over the fixture below. If it moves, a default is being written somewhere.
 */
const LEGACY_HASH = "5e40d57363faa521";

const SHAPES = [
  "rectangle",
  "rounded",
  "stadium",
  "diamond",
  "hexagon",
  "parallelogram",
  "cylinder",
  "circle",
  "subroutine",
] as const;

function legacyComponents(): Record<string, Record<string, unknown>> {
  const components: Record<string, Record<string, unknown>> = {};
  for (const shape of SHAPES) {
    components[`p-${shape}`] = {
      id: `p-${shape}`,
      name: `Step ${shape}`,
      description: "",
      parentId: null,
      type: "process-node",
      flowShape: shape,
    };
  }
  // What the old UI could already leave on a flow node: a toolbar colour
  // (customColor), a preset's nodeColor, and the inspector's technology field.
  components["p-toolbar"] = {
    id: "p-toolbar",
    name: "Toolbar coloured",
    description: "picked in the toolbar",
    parentId: null,
    type: "process-node",
    flowShape: "rectangle",
    customColor: "hsl(175 65% 42%)",
  };
  components["p-legacy-fill"] = {
    id: "p-legacy-fill",
    name: "Preset fill",
    description: "",
    parentId: null,
    type: "process-node",
    flowShape: "diamond",
    nodeColor: "#ff0000",
  };
  components["p-tech"] = {
    id: "p-tech",
    name: "Orders",
    description: "",
    parentId: null,
    type: "process-node",
    flowShape: "cylinder",
    technology: "PostgreSQL",
  };
  return components;
}

function legacyConnections(): Record<string, Record<string, unknown>> {
  const ids = Object.keys(legacyComponents());
  const connections: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i < ids.length - 1; i += 1) {
    connections[`c${i}`] = {
      id: `c${i}`,
      sourceId: ids[i],
      targetId: ids[i + 1],
      label: "next",
      style: { edgeStyle: "editable-step" },
    };
  }
  return connections;
}

function surface() {
  const components = legacyComponents();
  const nodeLayouts: Record<string, Record<string, unknown>> = {};
  Object.keys(components).forEach((id, index) => {
    nodeLayouts[id] = { elementId: id, x: index * 200, y: 40, width: 160, height: 60 };
  });
  return {
    activeVersionId: null,
    compareVersionId: null,
    components,
    connections: legacyConnections(),
    description: "",
    diagramName: "flow parity",
    domain: "",
    edgeLayouts: {},
    flows: {},
    iconLibrary: {},
    nodeLayouts,
    versions: {},
  };
}

describe("flow skin — checksum parity with main", () => {
  it("hashes an unedited legacy flowchart exactly as main did", () => {
    expect(snapshotChecksum(surface())).toBe(LEGACY_HASH);
  });

  it("does move once someone actually sets a part (the control)", () => {
    // Without this, a hash that ignored components entirely would pass above.
    const edited = surface();
    edited.components["p-diamond"] = { ...edited.components["p-diamond"], fill: "soft" };
    expect(snapshotChecksum(edited)).not.toBe(LEGACY_HASH);
  });

  it("writes nothing back while building the canvas nodes", () => {
    const state = surface();
    const before = JSON.stringify(state);
    const descriptor = getElement("process-node")!;
    const components = state.components as unknown as Record<string, Component>;
    const ctx = {
      ...emptyNodeBuildContext(),
      resolvedComponents: components,
      connectionCounts: buildConnectionCountPerNode(
        Object.values(state.connections) as unknown as Connection[],
      ),
    };
    for (const component of Object.values(components)) {
      descriptor.canvas.buildData(component, ctx);
      descriptor.canvas.buildStyle?.(component, ctx);
      descriptor.export.drawio.toExportNode(component, {
        id: component.id,
        parentId: null,
        x: 0,
        y: 0,
        width: 160,
        height: 60,
      });
    }
    expect(JSON.stringify(state)).toBe(before);
    expect(snapshotChecksum(state)).toBe(LEGACY_HASH);
  });
});
