import { describe, expect, it } from "vitest";
import {
  EdgeMarker,
  EdgeStyle,
  PanelKind,
  StrokeStyle,
  type Component,
  type Connection,
  type Diagram,
  type EdgeLayout,
  type NodeLayout,
  type ServiceDefinition,
} from "@/features/diagram";
import { exportDrawio } from "./export-drawio";

/**
 * GOLDEN FREEZE — captures the app draw.io XML byte-for-byte.
 *
 * Expected drift when cloudServiceId starts appearing on aws/image/passthrough
 * cells: those nodes wrap in `<object cloudServiceId="…">` so domain service
 * identity survives beyond icon appearance. Update the snapshot deliberately
 * when that content changes; do not paper over accidental diffs.
 */

const catalog: Record<string, ServiceDefinition> = {
  "svc-pay": {
    id: "svc-pay",
    name: "Payments",
    description: "Payments service",
    repositoryUrl: "https://example.com/pay",
    technology: ["Node.js"],
  },
};

function diagram(
  name: string,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  nodeLayouts: Record<string, NodeLayout>,
  edgeLayouts: Record<string, EdgeLayout> = {},
): Diagram {
  return {
    id: "d1",
    name,
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components, connections, flows: {}, iconLibrary: {} },
    nodeLayouts,
    edgeLayouts,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

const richComponents: Record<string, Component> = {
  p1: { id: "p1", name: "User A", type: "person", description: "", parentId: null },
  p2: { id: "p2", name: "User B", type: "person", description: "", parentId: null },
  sys: {
    id: "sys",
    name: "System",
    type: "system",
    description: "Core",
    technology: "Node.js",
    parentId: null,
    serviceId: "svc-pay",
  },
  panel: {
    id: "panel",
    name: "Novo Painel",
    type: "panel",
    panelKind: PanelKind.Default,
    panelColor: "#ff0000",
    description: "",
    parentId: null,
  },
  cont: {
    id: "cont",
    name: "Container",
    type: "container",
    description: "worker",
    technology: "Go",
    parentId: "panel",
  },
  comp: { id: "comp", name: "Component", type: "component", description: "", parentId: "panel" },
  note: {
    id: "note",
    name: "Nota",
    type: "note",
    description: "### Title\nbody text",
    parentId: null,
  },
  aws: {
    id: "aws",
    name: "Lambda",
    type: "aws-compute",
    cloudServiceId: "lambda",
    description: "",
    parentId: null,
  },
  awsApi: {
    id: "awsApi",
    name: "API Gateway",
    type: "aws-networking",
    // Catalog id (RESICON → api_gateway). Pre-F5b used a non-catalog alias
    // that always exported the generic "general" icon.
    cloudServiceId: "api-gateway",
    description: "",
    parentId: null,
  },
  // F4: first GCP golden — exports as kind:"image" with the catalog SVG when
  // the icon pack resolves, otherwise passthrough. Documents the decision to
  // add a fixture rather than only confirming an existing one.
  gcp: {
    id: "gcp",
    name: "Cloud Run",
    type: "gcp-compute",
    cloudServiceId: "cloudrun",
    description: "",
    parentId: null,
  },
  // F5a: Azure golden — passthrough (npm React icons, no sync SVG embed).
  azure: {
    id: "azure",
    name: "Azure Functions",
    type: "azure-compute",
    cloudServiceId: "functions",
    description: "",
    parentId: null,
  },
  api: {
    id: "api",
    name: "Orders API",
    type: "api-group",
    serviceName: "Orders",
    basePath: "/v1",
    protocol: "REST",
    description: "",
    parentId: null,
  },
  ep: {
    id: "ep",
    name: "Get orders",
    type: "endpoint",
    method: "GET",
    path: "/orders",
    endpointDescription: "list",
    handlers: [],
    description: "",
    parentId: "api",
  },
  db: {
    id: "db",
    name: "users table",
    type: "db-table",
    tableName: "users",
    columns: [
      { id: "c1", name: "id", dataType: "uuid" },
      { id: "c2", name: "email", dataType: "text" },
    ],
    description: "",
    parentId: null,
  },
  json: {
    id: "json",
    name: "Payload",
    type: "json-viewer",
    jsonContent: '{"a":1,"b":[2,3]}',
    schemaRef: "Order",
    description: "",
    parentId: null,
  },
};

const richConnections: Record<string, Connection> = {
  e1: {
    id: "e1",
    sourceId: "p1",
    targetId: "sys",
    label: "Usa",
    technology: "HTTPS",
    intent: "call",
  },
  e2: { id: "e2", sourceId: "p2", targetId: "sys", label: "Usa" },
  e3: {
    id: "e3",
    sourceId: "sys",
    targetId: "cont",
    label: "streams",
    intent: "data-flow",
    style: { edgeStyle: EdgeStyle.Step, strokeStyle: StrokeStyle.Dashed },
  },
  e4: {
    id: "e4",
    sourceId: "cont",
    targetId: "comp",
    label: "calls",
    direction: "bidirectional",
    style: { edgeStyle: EdgeStyle.Bezier, markerStart: EdgeMarker.Arrow },
  },
  e5: { id: "e5", sourceId: "sys", targetId: "db", label: "reads" },
  // Edge to Note: validates entryX=0 (left side) on the Note's target handle.
  eNote: { id: "eNote", sourceId: "sys", targetId: "note", label: "annotates" },
  // AWS as source: validates exitX=1 (right side) on Lambda's source handle.
  eAws1: { id: "eAws1", sourceId: "aws", targetId: "awsApi", label: "invokes" },
  // AWS as target: validates entryX=0 on API Gateway's target handle.
  eAws2: {
    id: "eAws2",
    sourceId: "awsApi",
    targetId: "aws",
    label: "routes to",
    direction: "bidirectional" as const,
  },
};

// C4 layouts carry real measured sizes (React Flow persists them into nodeLayouts after
// render). The export uses canonical C4_META boxes for geometry, NOT these measured sizes.
// The gap between stacked/adjacent C4 nodes is preserved by computeCompensationOffsets
// (A1-compensation): it pushes overlapping nodes apart in Y before building the XML.
// The measured sizes in the fixture exist because the real diagram was rendered, but the
// export uses C4_META canonical dimensions + offsets — see ADR-0009 A1-compensation.
const richLayouts: Record<string, NodeLayout> = {
  p1: { elementId: "p1", x: 0, y: 0, width: 180, height: 64 },
  p2: { elementId: "p2", x: 0, y: 160, width: 180, height: 64 },
  sys: { elementId: "sys", x: 340, y: 80, width: 200, height: 72 },
  panel: { elementId: "panel", x: 700, y: 0, width: 500, height: 360 },
  cont: { elementId: "cont", x: 20, y: 60, width: 200, height: 72 },
  comp: { elementId: "comp", x: 20, y: 200, width: 190, height: 66 },
  note: { elementId: "note", x: 1300, y: 0, width: 336, height: 475 },
  aws: { elementId: "aws", x: 0, y: 420 },
  awsApi: { elementId: "awsApi", x: 350, y: 420 },
  gcp: { elementId: "gcp", x: 0, y: 560, width: 180, height: 80 },
  azure: { elementId: "azure", x: 220, y: 560, width: 180, height: 80 },
  api: { elementId: "api", x: 400, y: 440, width: 300, height: 160 },
  ep: { elementId: "ep", x: 0, y: 68, width: 300, height: 40 },
  db: { elementId: "db", x: 820, y: 440 },
  json: { elementId: "json", x: 1200, y: 440 },
};

const richEdgeLayouts: Record<string, EdgeLayout> = {
  e5: { points: [{ id: "w1", x: 600, y: 320 }] },
};

describe("golden — app draw.io export", () => {
  it("freezes the comprehensive diagram XML", () => {
    const xml = exportDrawio(
      diagram("Golden", richComponents, richConnections, richLayouts, richEdgeLayouts),
      catalog,
    );
    expect(xml).toMatchSnapshot();
  });

  it("freezes a partial (componentIds) export", () => {
    const xml = exportDrawio(
      diagram("Golden", richComponents, richConnections, richLayouts, richEdgeLayouts),
      catalog,
      { componentIds: ["cont", "comp"] },
    );
    expect(xml).toMatchSnapshot();
  });
});

/**
 * One of every flowchart shape, and one of every colour part — the old golden
 * had no flow node at all, so the flowNode builder ran nowhere. Also an edge
 * that leaves a decision from its bottom handle and one that enters a step on
 * its top handle, which must export at those anchors rather than right/left.
 */
describe("golden — flowchart shapes", () => {
  const SHAPES = [
    "rectangle",
    "rounded",
    "subroutine",
    "stadium",
    "diamond",
    "hexagon",
    "parallelogram",
    "cylinder",
    "circle",
    "start",
    "end",
    "document",
    "event",
    "junction-and",
    "junction-or",
    "annotation",
    "evidence",
  ] as const;

  const flow = (
    id: string,
    shape: (typeof SHAPES)[number],
    extra: Partial<Extract<Component, { type: "process-node" }>> = {},
  ): Component => ({
    id,
    name: id,
    description: "",
    parentId: null,
    type: "process-node",
    flowShape: shape,
    ...extra,
  });

  const components: Record<string, Component> = {
    ...Object.fromEntries(SHAPES.map((shape) => [`s-${shape}`, flow(`s-${shape}`, shape)])),
    soft: flow("soft", "rectangle", { customColor: "hsl(var(--node-system))", fill: "soft" }),
    solidAmber: flow("solidAmber", "rectangle", {
      customColor: "hsl(var(--node-person))",
      fill: "solid",
    }),
    solidPurple: flow("solidPurple", "diamond", {
      customColor: "hsl(var(--node-container))",
      fill: "solid",
    }),
    dashed: flow("dashed", "rectangle", { stroke: "dashed" }),
    legacy: flow("legacy", "rectangle", { nodeColor: "#ff0000" }),
    tech: flow("tech", "cylinder", { technology: "PostgreSQL" }),
  };

  const ids = Object.keys(components);
  const layouts: Record<string, NodeLayout> = Object.fromEntries(
    ids.map((id, index) => [
      id,
      {
        elementId: id,
        x: (index % 5) * 280,
        y: Math.floor(index / 5) * 180,
        width: 200,
        height: 80,
      },
    ]),
  );

  const connections: Record<string, Connection> = {
    plain: { id: "plain", sourceId: "s-rectangle", targetId: "s-diamond", label: "" },
    down: {
      id: "down",
      sourceId: "s-diamond",
      targetId: "s-cylinder",
      label: "no",
      sourceSide: "bottom",
      targetSide: "top",
    },
  };

  it("freezes every shape and colour part", () => {
    const xml = exportDrawio(diagram("Flow", components, connections, layouts), catalog);
    expect(xml).toMatchSnapshot();
    // The bottom/top edge is exported at those anchors, not the fixed sides.
    expect(xml).toMatch(/id="down"[^>]*>.*?exitX="0\.5" exitY="1"/s);
    expect(xml).toMatch(/id="down"[^>]*>.*?entryX="0\.5" entryY="0"/s);
  });
});

/**
 * One instance of every Value Stream Mapping element, exported through the
 * generic stencil kind onto draw.io's own `mxgraph.lean_mapping.*` shapes.
 */
describe("golden — value stream map", () => {
  const vsm = (id: string, extra: Record<string, unknown>): Component =>
    ({ id, name: id, description: "", parentId: null, ...extra }) as unknown as Component;

  const components: Record<string, Component> = {
    supplier: vsm("supplier", { type: "vsm-external" }),
    customer: vsm("customer", {
      type: "vsm-external",
      role: "customer",
      customColor: "hsl(var(--node-system))",
      fill: "soft",
    }),
    process: vsm("process", {
      type: "vsm-process",
      operators: 2,
      metrics: [
        { id: "m1", key: "C/T", value: "45 s" },
        { id: "m2", key: "C/O", value: "10 min" },
      ],
      fill: "solid",
      customColor: "hsl(var(--node-container))",
    }),
    inventory: vsm("inventory", { type: "vsm-inventory", quantity: "1200 pcs", duration: "2 d" }),
    supermarket: vsm("supermarket", { type: "vsm-supermarket", stroke: "dashed" }),
    push: vsm("push", { type: "vsm-push" }),
    kaizen: vsm("kaizen", { type: "vsm-kaizen", fill: "solid" }),
    timeline: vsm("timeline", {
      type: "vsm-timeline",
      unit: "d",
      segments: [
        { id: "s1", wait: 5, process: 0.5 },
        { id: "s2", wait: 3, process: 1 },
      ],
    }),
  };

  const ids = Object.keys(components);
  const layouts: Record<string, NodeLayout> = Object.fromEntries(
    ids.map((id, index) => [id, { elementId: id, x: index * 260, y: 0, width: 200, height: 100 }]),
  );

  // Information flow: manual is a plain straight edge, electronic a zigzag.
  const connections: Record<string, Connection> = {
    manual: {
      id: "manual",
      sourceId: "supplier",
      targetId: "process",
      label: "",
      style: { edgeStyle: EdgeStyle.Straight },
    },
    electronic: {
      id: "electronic",
      sourceId: "process",
      targetId: "customer",
      label: "EDI",
      style: { edgeStyle: EdgeStyle.Zigzag },
    },
  };

  it("freezes every VSM element", () => {
    const xml = exportDrawio(diagram("VSM", components, connections, layouts), catalog);
    expect(xml).toMatchSnapshot();
    expect(xml).toContain("shape=mxgraph.lean_mapping.outside_sources;");
    expect(xml).toContain("shape=mxgraph.lean_mapping.manufacturing_process;");
    expect(xml).toContain("shape=mxgraph.lean_mapping.inventory_box;");
    expect(xml).toContain("shape=mxgraph.lean_mapping.supermarket;");
    expect(xml).toContain("shape=mxgraph.lean_mapping.push_arrow;");
    expect(xml).toContain("shape=mxgraph.lean_mapping.kaizen_lightening_burst;");
    expect(xml).toContain("shape=mxgraph.lean_mapping.timeline2;");
    expect(xml).toContain("shape=mxgraph.lean_mapping.electronic_info_flow_edge;");
    // The totals are computed from the segments: 5 + 0.5 + 3 + 1 and 0.5 + 1.
    expect(xml).toContain("Lead time: 9.5 d");
    expect(xml).toContain("Value-added time: 1.5 d");
  });
});
