/**
 * M2 fixture for the canvas virtualization epic (1000 nodes / 1300 edges, 2 panel levels).
 * Copy of build-nodes/make-fixtures.mjs with only the M2 spec added; the generator
 * function, the seed and the emitted shape are byte-for-byte the original.
 * Originals are never edited (session rule).
 * Deterministic Structura fixtures for the canvas core audit.
 * SEED = 20260911. Pure function of the seed — rerunning gives byte-identical output.
 * Emits ~/structura-scratch/auditoria-core-canvas/fixtures/{P,M,G}.json and seed.json,
 * each a persisted `structura_diagram-store` payload (schema v12).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SEED = 20260911;
const PERSIST_SCHEMA_VERSION = 12;

// mulberry32 — deterministic PRNG
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const C4 = ["person", "system", "container", "component"];
const AWS = ["compute", "storage", "database", "networking"];

function buildDiagram({ id, name, nodeCount, edgeCount, panelSpec, mixed, waypointRatio }) {
  const r = rng(SEED + nodeCount * 7919);
  const components = {};
  const connections = {};
  const nodeLayouts = {};
  const edgeLayouts = {};

  // --- panels: panelSpec = [count at depth 0, count at depth 1, ...] ---
  const panelsByDepth = [];
  let panelSeq = 0;
  for (let depth = 0; depth < panelSpec.length; depth++) {
    const level = [];
    for (let i = 0; i < panelSpec[depth]; i++) {
      const pid = `${id}-panel-${panelSeq++}`;
      const parents = depth === 0 ? [null] : panelsByDepth[depth - 1];
      const parentId = parents[i % parents.length];
      components[pid] = {
        id: pid,
        name: `Panel D${depth}-${i}`,
        description: "",
        parentId,
        type: "panel",
        panelKind: "group",
      };
      nodeLayouts[pid] = {
        elementId: pid,
        x: depth === 0 ? 120 + i * 1100 : 60 + i * 40,
        y: depth === 0 ? 120 + i * 900 : 80 + i * 40,
        width: 980 - depth * 260,
        height: 760 - depth * 200,
        zIndex: 0,
      };
      level.push(pid);
    }
    panelsByDepth.push(level);
  }
  const allPanels = panelsByDepth.flat();
  const deepestPanels = panelsByDepth[panelsByDepth.length - 1];

  // --- leaf nodes ---
  const leafIds = [];
  const leafCount = nodeCount - allPanels.length;
  for (let i = 0; i < leafCount; i++) {
    const nid = `${id}-n-${i}`;
    let type;
    if (!mixed) type = C4[i % C4.length];
    else {
      const bucket = i % 10;
      type = bucket < 5 ? C4[i % C4.length] : bucket < 8 ? AWS[i % AWS.length] : "note";
    }
    // 60% of leaves live inside the deepest panels, the rest on the canvas
    const inPanel = r() < 0.6 && deepestPanels.length > 0;
    const parentId = inPanel ? deepestPanels[i % deepestPanels.length] : null;
    const comp = { id: nid, name: `${type}-${i}`, description: "", parentId, type };
    if (type === "note") comp.panelColor = undefined;
    components[nid] = comp;
    const col = i % 6;
    const row = Math.floor(i / 6);
    nodeLayouts[nid] = {
      elementId: nid,
      x: parentId ? 45 + col * 150 : 1400 + col * 210,
      y: parentId ? 70 + row * 110 : 120 + row * 130,
      zIndex: 1,
    };
    leafIds.push(nid);
  }

  // --- connections between leaves ---
  for (let i = 0; i < edgeCount; i++) {
    const a = leafIds[Math.floor(r() * leafIds.length)];
    let b = leafIds[Math.floor(r() * leafIds.length)];
    if (a === b) b = leafIds[(leafIds.indexOf(a) + 1) % leafIds.length];
    const cid = `${id}-c-${i}`;
    connections[cid] = {
      id: cid,
      sourceId: a,
      targetId: b,
      label: `call ${i}`,
      style: { edgeStyle: "editable-step" },
    };
    if (r() < waypointRatio) {
      const base = nodeLayouts[a];
      edgeLayouts[cid] = {
        points: [
          { id: `${cid}-p0`, x: base.x + 90, y: base.y - 60 },
          { id: `${cid}-p1`, x: base.x + 200, y: base.y - 60 },
        ],
      };
    }
  }

  return {
    id,
    name,
    level: "container",
    createdAt: 1757548800000,
    updatedAt: 1757548800000,
    snapshot: { components, connections, flows: {}, iconLibrary: {} },
    nodeLayouts,
    edgeLayouts,
    viewport: { x: 0, y: 0, zoom: 0.5 },
    folderId: null,
  };
}

const specs = {
  M2: { id: "audit-M2", name: "AUDIT-M2 (1000n/1300e)", nodeCount: 1000, edgeCount: 1300, panelSpec: [4, 8], mixed: true, waypointRatio: 0.2 },
};

const outDir = join(homedir(), "structura-scratch/build-nodes/fixtures");
mkdirSync(outDir, { recursive: true });

const report = { seed: SEED, schemaVersion: PERSIST_SCHEMA_VERSION, fixtures: {} };
for (const [key, spec] of Object.entries(specs)) {
  const d = buildDiagram(spec);
  const payload = {
    state: {
      diagrams: { [d.id]: d },
      folders: {},
      userTemplates: {},
      serviceCatalog: {},
      activeDiagramId: d.id,
    },
    version: PERSIST_SCHEMA_VERSION,
  };
  writeFileSync(join(outDir, `${key}.json`), JSON.stringify(payload));
  const comps = Object.values(d.snapshot.components);
  report.fixtures[key] = {
    diagramId: d.id,
    nodes: comps.length,
    panels: comps.filter((c) => c.type === "panel").length,
    edges: Object.keys(d.snapshot.connections).length,
    edgesWithWaypoints: Object.keys(d.edgeLayouts).length,
    types: [...new Set(comps.map((c) => c.type))].sort(),
    bytes: JSON.stringify(payload).length,
  };
}
writeFileSync(join(outDir, "seed-m2.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
