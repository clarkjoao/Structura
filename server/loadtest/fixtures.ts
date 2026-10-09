import { emptyDiagramState, type DiagramState } from "../src/collab/protocol.js";

/**
 * A diagram shaped like the seed workspace, at any size: components with the fields an editor
 * writes, a layout per node, a connection per node, nesting in groups of ten, a handful of custom
 * icons and one saved version. Measured per node it lands near the seed diagrams (0.4–1.3 KB).
 */
export function makeDiagram(nodes: number, id = "load-diagram"): DiagramState {
  const state = emptyDiagramState();
  state.doc = { diagramId: id, diagramName: `Load ${nodes}`, level: "deployment", domain: "load" };
  const groups = Math.ceil(nodes / 10);
  for (let g = 0; g < groups; g++) {
    const gid = `grp_${g}`;
    state.entities.components[gid] = {
      id: gid,
      name: `Subnet ${g}`,
      description: `Private subnet ${g} of the workload VPC`,
      type: "panel",
      parentId: null,
      technology: "AWS VPC subnet",
    };
    state.entities.nodeLayouts[gid] = {
      elementId: gid,
      x: (g % 8) * 900,
      y: Math.floor(g / 8) * 700,
      width: 860,
      height: 640,
    };
  }
  for (let i = 0; i < nodes; i++) {
    const cid = `cmp_${i}`;
    state.entities.components[cid] = {
      id: cid,
      name: `Service ${i}`,
      description: `Handles part ${i} of the checkout flow; owned by team ${i % 7}.`,
      type: i % 5 === 0 ? "database" : "container",
      parentId: `grp_${Math.floor(i / 10)}`,
      technology: i % 5 === 0 ? "PostgreSQL 16" : "Node.js 22 / Fastify",
      tags: ["payments", `team-${i % 7}`],
      externalLinks: [{ label: "Runbook", url: `https://runbooks.example.com/service-${i}` }],
    };
    state.entities.nodeLayouts[cid] = {
      elementId: cid,
      x: 40 + (i % 5) * 160,
      y: 60 + Math.floor((i % 10) / 5) * 280,
      width: 140,
      height: 90,
    };
    if (i > 0) {
      const kid = `conn_${i}`;
      state.entities.connections[kid] = {
        id: kid,
        sourceId: `cmp_${i - 1}`,
        targetId: cid,
        label: "calls",
        technology: "HTTPS/JSON",
        sourceSide: "right",
        targetSide: "left",
      };
    }
  }
  for (let k = 0; k < 8; k++) {
    state.entities.iconLibrary[`icon_${k}`] = {
      id: `icon_${k}`,
      name: `Custom ${k}`,
      source: {
        kind: "svg",
        svgContent: `<svg viewBox="0 0 24 24"><path d="M${k} 0L24 ${k}Z"/></svg>`,
      },
    };
  }
  state.entities.versions.v1 = {
    id: "v1",
    name: "Before migration",
    color: "#888",
    createdAt: 0,
    addedComponents: {},
    addedConnections: {},
    removedComponentIds: ["cmp_1", "cmp_2"],
    removedConnectionIds: [],
    nodeLayouts: {},
  };
  return state;
}
