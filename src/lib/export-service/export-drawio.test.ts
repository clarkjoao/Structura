import { describe, expect, it } from "vitest";
import { PanelKind, type Diagram } from "@/features/diagram";
import { exportDrawio, extractMxGraphModelXml } from "./export-drawio";

function minimalDiagram(overrides: Partial<Diagram> = {}): Diagram {
  const base: Diagram = {
    id: "d1",
    name: "Test",
    level: "context",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    snapshot: {
      components: {},
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: [],
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
    // BBox from root panel only (100,200)–(500,500); scale=1; panel → (80,80); child keeps relative (40,50)
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
    // Root bbox on api-group (10,20)–(310,180); scale=1; group → (80,80); endpoint relative (0,68)
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
    // Two roots: bbox (−100,−50)–(440,220); scale 2.5; a → (80,80), b → (830,455)
    expect(xml).toContain(`<mxGeometry x="80" y="80"`);
    expect(xml).toContain(`<mxGeometry x="830" y="455"`);
    expect(xml).toContain(`pageWidth="1510"`);
  });
});
