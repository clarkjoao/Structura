/**
 * A large generated diagram shaped like the ones that motivated the
 * large-diagram performance work (see `openspec/changes/large-diagram-performance`):
 *
 * - ~657 nodes, ~711 edges, ~2.9k route corners, ~1.2 MB persisted
 * - a canvas of roughly 29k x 66k px, opened at zoom 0.3
 * - 9 large panels with up to 97 children, 47 empty panels stacked in a column
 * - ~38% of edges cross panels; the longest ones span tens of thousands of px
 * - children placed relative to their panel, route corners in absolute canvas space
 * - ~153 nodes with no edge; 21 `shared-ref` copies of 6 originals
 *
 * Deterministic (seeded PRNG) so a baseline and a later run measure the same
 * diagram. Written at the current persist schema version, so no migration runs
 * on load.
 */
import { DIAGRAM_STORE_LOCAL_STORAGE_KEY } from "./seed-stress-diagram";

/** Must equal `PERSIST_SCHEMA_VERSION` in `persist.config.ts`. */
export const LARGE_SEED_PERSIST_VERSION = 16;

const NODE_W = 220;
const NODE_H = 110;
const CHILD_COL_GAP = 820;
const CHILD_ROW_GAP = 1400;
const CHILD_COLS = 10;
const PANEL_PAD = 120;
const PANEL_GAP = 1500;
const EMPTY_PANEL_W = 900;
const EMPTY_PANEL_H = 400;
const EMPTY_PANEL_GAP = 1000;

/** Children per large panel: 532 in all, the largest 97. */
const LARGE_PANEL_CHILDREN = [97, 80, 70, 60, 55, 50, 45, 40, 35] as const;
const EMPTY_PANELS = 47;
const ROOT_NODES = 69;
const SHARED_ORIGINALS = 6;
const SHARED_REFS = 21;
const EDGE_COUNT = 711;
const UNCONNECTED = 153;
const CROSS_PANEL_SHARE = 0.38;
/** Pads each node's description so the payload lands near the real ~1.2 MB. */
const DESCRIPTION = "Generated for the large-diagram performance baseline. ".repeat(22);

export interface LargeSeedResult {
  localStoragePayload: string;
  diagramId: string;
  largePanelIds: string[];
  emptyPanelIds: string[];
  leafIds: string[];
  stats: {
    nodes: number;
    edges: number;
    routePoints: number;
    bytes: number;
    canvasWidth: number;
    canvasHeight: number;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const LEAF_TYPES = ["container", "component", "system"] as const;
const TECHS = ["Java", "Go", "Node.js", "PostgreSQL", "Kafka", "Redis", "Python", "S3"];

export function buildLargeDiagramSeed(seed = 20261105): LargeSeedResult {
  const rand = mulberry32(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;

  const diagramId = "diag_large_perf";
  const components: Record<string, Record<string, unknown>> = {};
  const nodeLayouts: Record<string, Record<string, unknown>> = {};
  const connections: Record<string, Record<string, unknown>> = {};
  const edgeLayouts: Record<string, { points: { id: string; x: number; y: number }[] }> = {};
  /** Absolute box of every leaf — the router works in canvas space. */
  const absBox = new Map<string, Box>();
  /** Which large panel a leaf lives in; `null` for root nodes. */
  const panelOf = new Map<string, string | null>();

  const largePanelIds: string[] = [];
  const emptyPanelIds: string[] = [];
  const leafIds: string[] = [];
  let seq = 0;
  const id = (prefix: string) => `${prefix}_${(seq += 1)}`;

  const addLeaf = (
    leafId: string,
    parentId: string | null,
    rel: { x: number; y: number },
    abs: { x: number; y: number },
    extra: Record<string, unknown> = {},
  ) => {
    components[leafId] = {
      id: leafId,
      name: `Service ${leafId}`,
      description: DESCRIPTION,
      parentId,
      type: pick(LEAF_TYPES),
      technology: pick(TECHS),
      ...extra,
    };
    nodeLayouts[leafId] = { elementId: leafId, x: rel.x, y: rel.y, width: NODE_W, height: NODE_H };
    absBox.set(leafId, { x: abs.x, y: abs.y, w: NODE_W, h: NODE_H });
    panelOf.set(leafId, parentId);
    leafIds.push(leafId);
  };

  // --- 9 large panels on a 3x3 grid --------------------------------------
  const panelW = PANEL_PAD * 2 + (CHILD_COLS - 1) * CHILD_COL_GAP + NODE_W;
  const panelH = (n: number) =>
    PANEL_PAD * 2 + (Math.ceil(n / CHILD_COLS) - 1) * CHILD_ROW_GAP + NODE_H;
  const rowHeights = [0, 1, 2].map((row) =>
    Math.max(...LARGE_PANEL_CHILDREN.slice(row * 3, row * 3 + 3).map(panelH)),
  );
  const childSlots: {
    panelId: string;
    rel: { x: number; y: number };
    abs: { x: number; y: number };
  }[] = [];

  LARGE_PANEL_CHILDREN.forEach((count, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const px = col * (panelW + PANEL_GAP);
    const py = rowHeights.slice(0, row).reduce((sum, h) => sum + h + PANEL_GAP, 0);
    const panelId = id("panel");
    components[panelId] = {
      id: panelId,
      name: `Domain ${index + 1}`,
      description: "",
      parentId: null,
      type: "panel",
      panelKind: "default",
      panelColor: "#6366f1",
    };
    nodeLayouts[panelId] = {
      elementId: panelId,
      x: px,
      y: py,
      width: panelW,
      height: panelH(count),
    };
    largePanelIds.push(panelId);
    for (let i = 0; i < count; i += 1) {
      const rel = {
        x: PANEL_PAD + (i % CHILD_COLS) * CHILD_COL_GAP,
        y: PANEL_PAD + Math.floor(i / CHILD_COLS) * CHILD_ROW_GAP,
      };
      childSlots.push({ panelId, rel, abs: { x: px + rel.x, y: py + rel.y } });
    }
  });

  const gridRight = 3 * panelW + 2 * PANEL_GAP;
  const gridBottom = rowHeights.reduce((sum, h) => sum + h + PANEL_GAP, 0);

  // --- 47 empty panels stacked in one column to the right -----------------
  const emptyX = gridRight + PANEL_GAP;
  for (let i = 0; i < EMPTY_PANELS; i += 1) {
    const panelId = id("empty");
    components[panelId] = {
      id: panelId,
      name: `Placeholder ${i + 1}`,
      description: "",
      parentId: null,
      type: "panel",
      panelKind: "default",
      panelColor: "#94a3b8",
    };
    nodeLayouts[panelId] = {
      elementId: panelId,
      x: emptyX,
      y: i * (EMPTY_PANEL_H + EMPTY_PANEL_GAP),
      width: EMPTY_PANEL_W,
      height: EMPTY_PANEL_H,
    };
    emptyPanelIds.push(panelId);
  }

  // --- 69 root nodes below the grid; the first 6 are shared originals ------
  const sharedOriginals: string[] = [];
  for (let i = 0; i < ROOT_NODES; i += 1) {
    const leafId = id("root");
    const pos = { x: (i % 20) * CHILD_COL_GAP, y: gridBottom + Math.floor(i / 20) * CHILD_ROW_GAP };
    addLeaf(leafId, null, pos, pos);
    if (i < SHARED_ORIGINALS) sharedOriginals.push(leafId);
  }

  // --- panel children; 21 of the slots are shared-ref copies ---------------
  const refSlots = new Set<number>();
  while (refSlots.size < SHARED_REFS) refSlots.add(Math.floor(rand() * childSlots.length));
  let refIndex = 0;
  childSlots.forEach((slot, index) => {
    if (refSlots.has(index)) {
      const refId = id("ref");
      const refOf = sharedOriginals[refIndex % SHARED_ORIGINALS]!;
      refIndex += 1;
      components[refId] = {
        id: refId,
        name: "",
        description: "",
        parentId: slot.panelId,
        type: "shared-ref",
        refOf,
      };
      nodeLayouts[refId] = { elementId: refId, x: slot.rel.x, y: slot.rel.y };
      absBox.set(refId, { x: slot.abs.x, y: slot.abs.y, w: NODE_W, h: NODE_H });
      panelOf.set(refId, slot.panelId);
      leafIds.push(refId);
      return;
    }
    addLeaf(id("leaf"), slot.panelId, slot.rel, slot.abs);
  });

  // --- 711 edges between the connected nodes ------------------------------
  const shuffled = [...leafIds].sort(() => rand() - 0.5);
  const connected = shuffled.slice(UNCONNECTED);
  const byPanel = new Map<string | null, string[]>();
  for (const leaf of connected) {
    const key = panelOf.get(leaf) ?? null;
    if (!byPanel.has(key)) byPanel.set(key, []);
    byPanel.get(key)!.push(leaf);
  }
  // Every connected node gets at least one edge, then the rest are random.
  let routePoints = 0;
  const addEdge = (sourceId: string, targetId: string) => {
    const connId = id("conn");
    connections[connId] = {
      id: connId,
      sourceId,
      targetId,
      label: pick(["calls", "reads", "publishes", "subscribes", "writes"]),
      technology: pick(["HTTPS", "gRPC", "Kafka", "SQL"]),
    };
    const points = route(absBox.get(sourceId)!, absBox.get(targetId)!, rand);
    routePoints += points.length;
    edgeLayouts[connId] = {
      points: points.map((p, k) => ({ id: `cp_${connId}_${k}`, x: p.x, y: p.y })),
    };
  };
  const partnerFor = (source: string): string => {
    const cross = rand() < CROSS_PANEL_SHARE;
    const home = panelOf.get(source) ?? null;
    if (!cross) {
      const local = byPanel.get(home) ?? connected;
      if (local.length > 1) {
        let candidate = pick(local);
        while (candidate === source) candidate = pick(local);
        return candidate;
      }
    }
    let candidate = pick(connected);
    while (candidate === source || (panelOf.get(candidate) ?? null) === home) {
      candidate = pick(connected);
    }
    return candidate;
  };
  for (let i = 0; i < connected.length && Object.keys(connections).length < EDGE_COUNT; i += 2) {
    const source = connected[i]!;
    const target = connected[i + 1] ?? partnerFor(source);
    addEdge(source, target);
  }
  while (Object.keys(connections).length < EDGE_COUNT) {
    const source = pick(connected);
    addEdge(source, partnerFor(source));
  }

  const now = Date.UTC(2026, 10, 5);
  const diagram = {
    id: diagramId,
    name: "Performance — large diagram",
    description: "Generated large-diagram performance fixture.",
    level: "container",
    domain: "",
    createdAt: now,
    updatedAt: now,
    snapshot: { components, connections, flows: {}, iconLibrary: {} },
    nodeLayouts,
    edgeLayouts,
    // Opened at 0.3 like the real diagrams, inset from the corner so a drag of the
    // first panel does not start inside React Flow's auto-pan margin.
    viewport: { x: 150, y: 150, zoom: 0.3 },
    versions: {},
    activeVersionId: null,
    compareVersionId: null,
  };
  const payload = {
    state: {
      diagrams: { [diagramId]: diagram },
      folders: {},
      userTemplates: {},
      services: {},
      activeDiagramId: diagramId,
    },
    version: LARGE_SEED_PERSIST_VERSION,
  };
  const localStoragePayload = JSON.stringify(payload);
  const emptyColumnBottom = EMPTY_PANELS * (EMPTY_PANEL_H + EMPTY_PANEL_GAP);

  return {
    localStoragePayload,
    diagramId,
    largePanelIds,
    emptyPanelIds,
    leafIds,
    stats: {
      nodes: Object.keys(components).length,
      edges: Object.keys(connections).length,
      routePoints,
      bytes: localStoragePayload.length,
      canvasWidth: emptyX + EMPTY_PANEL_W,
      canvasHeight: Math.max(gridBottom + 4 * CHILD_ROW_GAP, emptyColumnBottom),
    },
  };
}

/**
 * Orthogonal corners from the source's right side to the target's left side,
 * in absolute canvas space: 2 corners for a plain Z, 4 or 6 for a detour.
 */
function route(s: Box, t: Box, rand: () => number): { x: number; y: number }[] {
  const sx = s.x + s.w;
  const sy = s.y + s.h / 2;
  const tx = t.x;
  const ty = t.y + t.h / 2;
  const roll = rand();
  if (roll < 0.25 && tx > sx + 80) {
    const mx = Math.round((sx + tx) / 2);
    return [
      { x: mx, y: sy },
      { x: mx, y: ty },
    ];
  }
  const out = sx + 40 + Math.round(rand() * 60);
  const into = tx - 40 - Math.round(rand() * 60);
  const lane = Math.round(Math.min(sy, ty) - 200 - rand() * 400);
  if (roll < 0.7) {
    return [
      { x: out, y: sy },
      { x: out, y: lane },
      { x: into, y: lane },
      { x: into, y: ty },
    ];
  }
  const lane2 = Math.round(Math.max(sy, ty) + 200 + rand() * 400);
  const mid = Math.round((out + into) / 2);
  return [
    { x: out, y: sy },
    { x: out, y: lane },
    { x: mid, y: lane },
    { x: mid, y: lane2 },
    { x: into, y: lane2 },
    { x: into, y: ty },
  ];
}
