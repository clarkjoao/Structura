import { describe, expect, it } from "vitest";
import { PanelKind, type Diagram } from "@/features/diagram";
import { exportDrawio, extractMxGraphModelXml } from "./export-drawio";

function minimalDiagram(overrides: Partial<Diagram> = {}): Diagram {
  const base: Diagram = {
    id: "d1",
    name: "Test",
    level: "context",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    snapshot: {
      components: {},
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  return { ...base, ...overrides, snapshot: { ...base.snapshot, ...overrides.snapshot } };
}

describe("extractMxGraphModelXml", () => {
  it("strips mxfile wrapper", () => {
    const full =
      '<?xml version="1.0"?><mxfile><diagram name="x">' +
      '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>' +
      "</diagram></mxfile>";
    const inner = extractMxGraphModelXml(full);
    expect(inner).toBe('<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>');
    expect(inner.startsWith("<mxfile")).toBe(false);
  });
});

describe("exportDrawio", () => {
  it("exports child inside panel with relative coordinates (no double offset)", () => {
    const panelId = "panel-1";
    const childId = "sys-1";
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          [panelId]: {
            id: panelId,
            name: "Boundary",
            type: "panel",
            panelKind: PanelKind.Default,
            description: "",
            parentId: null,
          },
          [childId]: {
            id: childId,
            name: "Service",
            type: "system",
            description: "",
            parentId: panelId,
          },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {
        [panelId]: {
          elementId: panelId,
          x: 100,
          y: 200,
          width: 400,
          height: 300,
        },
        [childId]: {
          elementId: childId,
          x: 40,
          y: 50,
          width: 240,
          height: 120,
        },
      },
    });

    const xml = exportDrawio(diagram, {});

    expect(xml).toContain(`parent="${panelId}"`);
    expect(xml).toContain(`<mxGeometry x="40" y="50"`);
    expect(xml).toContain(`<mxGeometry x="80" y="80"`);
    expect(xml).toContain(`fit="1"`);
  });

  it("exports api-group and endpoints nested under the group", () => {
    const groupId = "api-1";
    const epId = "ep-1";
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          [groupId]: {
            id: groupId,
            name: "API",
            type: "api-group",
            description: "",
            parentId: null,
            serviceName: "Orders",
            basePath: "/api/v1",
            protocol: "REST",
          },
          [epId]: {
            id: epId,
            name: "Get",
            type: "endpoint",
            description: "",
            parentId: groupId,
            method: "GET",
            path: "/orders",
            handlers: [],
          },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {
        [groupId]: {
          elementId: groupId,
          x: 10,
          y: 20,
          width: 300,
          height: 160,
        },
        [epId]: {
          elementId: epId,
          x: 0,
          y: 68,
          width: 300,
          height: 40,
        },
      },
    });

    const xml = exportDrawio(diagram, {});

    expect(xml).toContain(`id="${groupId}"`);
    expect(xml).toContain(`parent="${groupId}"`);
    expect(xml).toContain(`id="${epId}"`);
    expect(xml).toContain(`<mxGeometry x="0" y="68"`);
    expect(xml).toContain(`<mxGeometry x="80" y="80"`);
  });

  it("partial export includes ancestor containers for valid nesting", () => {
    const panelId = "p1";
    const childId = "c1";
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          [panelId]: {
            id: panelId,
            name: "P",
            type: "panel",
            panelKind: PanelKind.Default,
            description: "",
            parentId: null,
          },
          [childId]: {
            id: childId,
            name: "Box",
            type: "container",
            description: "",
            parentId: panelId,
          },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {
        [panelId]: { elementId: panelId, x: 0, y: 0, width: 200, height: 200 },
        [childId]: { elementId: childId, x: 10, y: 10, width: 240, height: 120 },
      },
    });

    const xml = exportDrawio(diagram, {}, { componentIds: [childId] });
    expect(xml).toContain(`id="${panelId}"`);
    expect(xml).toContain(`id="${childId}"`);
  });

  it("shifts negative layouts into positive space with margin", () => {
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          a: {
            id: "a",
            name: "A",
            type: "system",
            description: "",
            parentId: null,
          },
          b: {
            id: "b",
            name: "B",
            type: "system",
            description: "",
            parentId: null,
          },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {
        a: { elementId: "a", x: -100, y: -50, width: 240, height: 120 },
        b: { elementId: "b", x: 200, y: 100, width: 240, height: 120 },
      },
    });

    const xml = exportDrawio(diagram, {});

    // Positions map 1:1 (shifted by bbox origin + margin only): the 300x150 gap
    // between the two roots in canvas space is preserved, not scaled up.
    expect(xml).toContain(`<mxGeometry x="80" y="80"`);
    expect(xml).toContain(`<mxGeometry x="380" y="230"`);
    expect(xml).toContain(`pageWidth="1169"`);
  });

  it("keeps a root note beside a boundary at 1:1 spacing (no scale-up)", () => {
    const panelId = "panel-1";
    const childId = "sys-1";
    const noteId = "note-1";
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          [panelId]: {
            id: panelId,
            name: "Novo Painel",
            type: "panel",
            panelKind: PanelKind.Default,
            description: "",
            parentId: null,
          },
          [childId]: {
            id: childId,
            name: "Traffic Splitter",
            type: "system",
            description: "",
            parentId: panelId,
          },
          [noteId]: {
            id: noteId,
            name: "Nota",
            type: "note",
            description: "### Nota",
            parentId: null,
          },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {
        [panelId]: { elementId: panelId, x: 0, y: 0, width: 400, height: 300 },
        [childId]: { elementId: childId, x: 20, y: 20, width: 240, height: 120 },
        [noteId]: { elementId: noteId, x: 600, y: 0, width: 336, height: 475 },
      },
    });

    const xml = exportDrawio(diagram, {});

    // Two roots (panel + note) previously triggered the >1 scale factor; now the
    // note sits at its canvas x (600) shifted by the margin only, and the boundary
    // child keeps its parent-relative coords.
    expect(xml).toContain(`<mxGeometry x="680" y="80"`);
    expect(xml).toContain(`parent="${panelId}"`);
    expect(xml).toContain(`<mxGeometry x="20" y="20"`);
  });
});

describe("exportDrawio — edge anchor inference", () => {
  it("flips exit/entry anchors when target is to the LEFT of source", () => {
    // Regression for the S3→Glue case: source is to the right of target,
    // so the edge must exit the source from its LEFT side and enter the
    // target from its RIGHT side. Otherwise the edge routes the long way
    // around and overlaps with sibling labels.
    const s3Id = "s3";
    const glueId = "glue";
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          [s3Id]: {
            id: s3Id,
            name: "Amazon S3",
            type: "aws-storage",
            awsService: "s3",
            description: "",
            parentId: null,
          },
          [glueId]: {
            id: glueId,
            name: "AWS Glue",
            type: "aws-analytics",
            awsService: "glue",
            description: "",
            parentId: null,
          },
        },
        connections: {
          e1: { id: "e1", sourceId: s3Id, targetId: glueId, label: "Usa" },
        },
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {
        [s3Id]: { elementId: s3Id, x: 850, y: 150, width: 200, height: 120 },
        [glueId]: { elementId: glueId, x: 0, y: 500, width: 200, height: 120 },
      },
    });

    const xml = exportDrawio(diagram, {});

    // Edge from S3 (right) to Glue (left): exit from S3's LEFT, enter Glue's RIGHT.
    expect(xml).toContain(`source="s3" target="glue"`);
    expect(xml).toContain(`exitX="0" exitY="0.5" entryX="1" entryY="0.5"`);
  });

  it("distributes handle slots when multiple edges share the same side", () => {
    // Two edges exit the same source on the right side — each should get a
    // different exitY (slot offset), not both at 0.5.
    const sysId = "sys";
    const aId = "a";
    const bId = "b";
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          [sysId]: {
            id: sysId,
            name: "Novo System",
            type: "system",
            description: "",
            parentId: null,
          },
          [aId]: { id: aId, name: "Target A", type: "system", description: "", parentId: null },
          [bId]: { id: bId, name: "Target B", type: "system", description: "", parentId: null },
        },
        connections: {
          e1: { id: "e1", sourceId: sysId, targetId: aId, label: "Usa" },
          e2: { id: "e2", sourceId: sysId, targetId: bId, label: "Usa" },
        },
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {
        [sysId]: { elementId: sysId, x: 0, y: 200, width: 200, height: 120 },
        [aId]: { elementId: aId, x: 400, y: 0, width: 200, height: 120 },
        [bId]: { elementId: bId, x: 400, y: 400, width: 200, height: 120 },
      },
    });

    const xml = exportDrawio(diagram, {});

    // Both edges should exit from the right (exitX=1) but with different exitY values.
    // Extract all edges that start at sys and exit from the right side.
    const sysEdges = [...xml.matchAll(/source="sys" target="[ab]"[^>]*?>([\s\S]*?)<\/mxCell>/g)];
    expect(sysEdges.length).toBe(2);
    const exitYs = sysEdges.map((m) => {
      const exitMatch = /exitY="(0\.\d+)"/.exec(m[1]);
      return exitMatch?.[1];
    });
    expect(exitYs).toHaveLength(2);
    expect(exitYs[0]).toBeDefined();
    expect(exitYs[1]).toBeDefined();
    expect(exitYs[0]).not.toBe(exitYs[1]);
  });

  it("clamps synthesized waypoints to container bounds with padding", () => {
    // Two siblings (b in the way) between source and target in the same
    // container: buildContainerWaypoints must produce waypoints that stay
    // inside the container with at least 5px padding (no clipping).
    const containerId = "c";
    const srcId = "s";
    const obstacleId = "b";
    const tgtId = "t";
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          [containerId]: {
            id: containerId,
            name: "Boundary",
            type: "panel",
            panelKind: PanelKind.Default,
            description: "",
            parentId: null,
          },
          [srcId]: {
            id: srcId,
            name: "S",
            type: "system",
            description: "",
            parentId: containerId,
          },
          [obstacleId]: {
            id: obstacleId,
            name: "Blocker",
            type: "system",
            description: "",
            parentId: containerId,
          },
          [tgtId]: {
            id: tgtId,
            name: "T",
            type: "system",
            description: "",
            parentId: containerId,
          },
        },
        connections: {
          e: { id: "e", sourceId: srcId, targetId: tgtId, label: "x" },
        },
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {
        [containerId]: { elementId: containerId, x: 0, y: 0, width: 800, height: 400 },
        [srcId]: { elementId: srcId, x: 40, y: 100, width: 200, height: 120 },
        [obstacleId]: { elementId: obstacleId, x: 300, y: 150, width: 200, height: 120 },
        [tgtId]: { elementId: tgtId, x: 560, y: 100, width: 200, height: 120 },
      },
    });

    const xml = exportDrawio(diagram, {});

    // The waypoints should be present (orthogonal route around the obstacle).
    expect(xml).toMatch(/<mxPoint/);
    // No waypoint should sit exactly on the container edge (x<5 or x>795).
    const waypoints = [...xml.matchAll(/<mxPoint x="(-?\d+)" y="(-?\d+)"/g)].map((m) => ({
      x: parseInt(m[1]),
      y: parseInt(m[2]),
    }));
    for (const w of waypoints) {
      // The export applies an origin shift (bbox.minX + margin), so raw
      // coordinates inside the container should be at least 5px from the edge.
      expect(w.x).toBeGreaterThanOrEqual(5);
    }
  });
});
