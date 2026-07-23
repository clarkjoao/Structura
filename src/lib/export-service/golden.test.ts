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
 * GOLDEN FREEZE — captures the app draw.io XML byte-for-byte before the
 * export-core refactor. The snapshot MUST NOT change when export-drawio.ts is
 * rewritten to go through the shared core; a diff here means the refactor
 * altered app output.
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
    awsService: "lambda",
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
};

// C4 layouts carry real measured sizes (as React Flow persists them into
// nodeLayouts). The export uses these directly instead of the C4_META floor (A1),
// so a Person measured 180×64 exports at 180×64 — not 240×120 — which is what
// keeps stacked/adjacent C4 nodes from overlapping.
const richLayouts: Record<string, NodeLayout> = {
  p1: { elementId: "p1", x: 0, y: 0, width: 180, height: 64 },
  p2: { elementId: "p2", x: 0, y: 160, width: 180, height: 64 },
  sys: { elementId: "sys", x: 340, y: 80, width: 200, height: 72 },
  panel: { elementId: "panel", x: 700, y: 0, width: 500, height: 360 },
  cont: { elementId: "cont", x: 20, y: 60, width: 200, height: 72 },
  comp: { elementId: "comp", x: 20, y: 200, width: 190, height: 66 },
  note: { elementId: "note", x: 1300, y: 0, width: 336, height: 475 },
  aws: { elementId: "aws", x: 0, y: 420 },
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
