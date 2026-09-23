/**
 * Rendered parity over every seed diagram and every way of reading one.
 *
 * `editor-viewer-render-parity.cy.ts` pins one hand-built diagram on one route.
 * This one asks the question the product asks: whichever way a diagram is
 * opened for reading, does it draw what the editor draws? Every seed, on every
 * reading surface:
 *
 *  - `/viewer?diagramId=` — the reader's own diagram, straight from the store;
 *  - `/viewer#data=`     — the embed link, as the share dialog writes it;
 *  - `/#share=`          — the share link, as the share dialog writes it.
 *
 * The links are read off the share dialog, not rebuilt here: a test that
 * encoded its own payload would check its own encoder, and what the reader
 * lacks is exactly what the real encoder does or does not put in.
 *
 * Compared per node: which nodes are drawn, the box in flow units (position and
 * size, measured on the card the handles are placed against), the stacking
 * order, and the computed fill, border and opacity — the panel colours are where
 * the divergence was first seen. Per edge: which edges are drawn and the points
 * each path visits.
 *
 * One seed is opened inside a scene, because the editor draws the scene the
 * author has open and a link has to draw the same one.
 */
const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";

/** Below this, two coordinates are the same point: float noise, not a difference. */
const TOLERANCE_PX = 0.01;

/** The seed opened inside a scene, and what the scene changes. */
const SCENE_ID = "scene_render_parity";
const SCENE_SHIFT_PX = 40;

interface NodeDrawing {
  x: number;
  y: number;
  w: number;
  h: number;
  z: string;
  fill: string;
  border: string;
  opacity: string;
}

interface Drawing {
  nodes: Record<string, NodeDrawing>;
  paths: Record<string, string>;
}

interface Point {
  x: number;
  y: number;
}

type Surface = "diagramId" | "data" | "share";
const SURFACES: readonly Surface[] = ["diagramId", "data", "share"];

function collect(win: Window): Drawing {
  const doc = win.document;
  const pane = doc.querySelector(".react-flow") as HTMLElement | null;
  const viewport = doc.querySelector(".react-flow__viewport") as HTMLElement | null;
  const matrix = viewport && /matrix\(([^)]+)\)/.exec(win.getComputedStyle(viewport).transform);
  const [zoom, , , , tx, ty] = matrix ? matrix[1].split(",").map(Number) : [1, 0, 0, 1, 0, 0];
  const origin = pane?.getBoundingClientRect() ?? { left: 0, top: 0 };

  const nodes: Record<string, NodeDrawing> = {};
  doc.querySelectorAll<HTMLElement>(".react-flow__node").forEach((node) => {
    const id = node.getAttribute("data-id");
    // The card, not React Flow's wrapper: the handles are placed against it.
    const card = node.firstElementChild as HTMLElement | null;
    if (!id || !card) return;
    const rect = card.getBoundingClientRect();
    const style = win.getComputedStyle(card);
    nodes[id] = {
      x: (rect.left - origin.left - tx) / zoom,
      y: (rect.top - origin.top - ty) / zoom,
      w: rect.width / zoom,
      h: rect.height / zoom,
      z: node.style.zIndex,
      fill: style.backgroundColor,
      border: style.borderColor,
      opacity: win.getComputedStyle(node).opacity,
    };
  });

  const paths: Record<string, string> = {};
  doc.querySelectorAll(".react-flow__edge").forEach((edge) => {
    const path = edge.querySelector(".react-flow__edge-path");
    const id = edge.getAttribute("data-id");
    if (path && id) paths[id] = path.getAttribute("d") ?? "";
  });
  return { nodes, paths };
}

/**
 * The points an H/V path actually visits — never the `d` string, which differs
 * in command count and last float digit for the same picture. A cubic segment
 * (`C`) contributes its end point and control points as they are.
 */
function visitedPoints(d: string): Point[] {
  const tokens = d
    .replace(/([MLHVCQZ])/gi, " $1 ")
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/);
  const points: Point[] = [];
  let current: Point = { x: 0, y: 0 };
  const push = (next: Point) => {
    const last = points[points.length - 1];
    if (
      !last ||
      Math.abs(last.x - next.x) > TOLERANCE_PX ||
      Math.abs(last.y - next.y) > TOLERANCE_PX
    ) {
      points.push(next);
    }
    current = next;
  };
  let command = "";
  for (let i = 0; i < tokens.length;) {
    if (/^[A-Za-z]$/.test(tokens[i])) {
      command = tokens[i];
      i += 1;
      continue;
    }
    const n = (k: number) => Number(tokens[i + k]);
    if (command === "M" || command === "L") {
      push({ x: n(0), y: n(1) });
      i += 2;
    } else if (command === "H") {
      push({ x: n(0), y: current.y });
      i += 1;
    } else if (command === "V") {
      push({ x: current.x, y: n(0) });
      i += 1;
    } else if (command === "C") {
      push({ x: n(0), y: n(1) });
      push({ x: n(2), y: n(3) });
      push({ x: n(4), y: n(5) });
      i += 6;
    } else if (command === "Q") {
      push({ x: n(0), y: n(1) });
      push({ x: n(2), y: n(3) });
      i += 4;
    } else {
      i += 1;
    }
  }
  return points;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE_PX;
}

/** Every way `read` draws `diagramId` differently from the editor, as readable lines. */
function differences(diagramId: string, editor: Drawing, read: Drawing | undefined): string[] {
  if (!read) return [`${diagramId}: not drawn`];
  const out: string[] = [];
  const tag = (id: string) => `${diagramId} ${id}`;

  for (const id of Object.keys(editor.nodes)) {
    const a = editor.nodes[id];
    const b = read.nodes[id];
    if (!b) {
      out.push(`${tag(id)}: missing`);
      continue;
    }
    if (!near(a.x, b.x) || !near(a.y, b.y) || !near(a.w, b.w) || !near(a.h, b.h)) {
      out.push(
        `${tag(id)}: box editor (${a.x}, ${a.y}) ${a.w}x${a.h} vs (${b.x}, ${b.y}) ${b.w}x${b.h}`,
      );
    }
    if (a.z !== b.z) out.push(`${tag(id)}: z ${a.z} vs ${b.z}`);
    if (a.fill !== b.fill) out.push(`${tag(id)}: fill ${a.fill} vs ${b.fill}`);
    if (a.border !== b.border) out.push(`${tag(id)}: border ${a.border} vs ${b.border}`);
    if (a.opacity !== b.opacity) out.push(`${tag(id)}: opacity ${a.opacity} vs ${b.opacity}`);
  }
  for (const id of Object.keys(read.nodes)) {
    if (!editor.nodes[id]) out.push(`${tag(id)}: drawn only when reading`);
  }

  for (const id of Object.keys(editor.paths)) {
    if (read.paths[id] === undefined) {
      out.push(`${tag(id)}: edge missing`);
      continue;
    }
    const a = visitedPoints(editor.paths[id]);
    const b = visitedPoints(read.paths[id]);
    if (a.length !== b.length || a.some((p, i) => !near(p.x, b[i].x) || !near(p.y, b[i].y))) {
      const show = (ps: Point[]) => ps.map((p) => `(${p.x}, ${p.y})`).join(" ");
      out.push(`${tag(id)}: edge editor ${show(a)} vs ${show(b)}`);
    }
  }
  for (const id of Object.keys(read.paths)) {
    if (editor.paths[id] === undefined) out.push(`${tag(id)}: edge drawn only when reading`);
  }
  return out;
}

interface StoredDiagram {
  id: string;
  snapshot: { components: Record<string, unknown> };
  nodeLayouts: Record<string, { x: number; y: number }>;
  versions?: Record<string, unknown>;
  activeVersionId?: string | null;
}

/**
 * Puts one seed inside a scene: the scene hides one component and moves
 * another, so a surface that draws the base instead is caught on both counts.
 */
function openInScene(diagram: StoredDiagram): void {
  const ids = Object.keys(diagram.nodeLayouts).filter((id) => diagram.snapshot.components[id]);
  const [moved, removed] = ids;
  const at = diagram.nodeLayouts[moved];
  diagram.versions = {
    ...(diagram.versions ?? {}),
    [SCENE_ID]: {
      id: SCENE_ID,
      name: "Render parity scene",
      color: "#6366f1",
      createdAt: 0,
      addedComponents: {},
      addedConnections: {},
      removedComponentIds: [removed],
      removedConnectionIds: [],
      nodeLayouts: { [moved]: { ...at, x: at.x + SCENE_SHIFT_PX, y: at.y + SCENE_SHIFT_PX } },
    },
  };
  diagram.activeVersionId = SCENE_ID;
}

/** Waits for the canvas to draw and settle, then reads it. */
function drawingAt(url: string, into: (drawing: Drawing) => void): void {
  cy.visit(url);
  cy.get(".react-flow__node", { timeout: 60000 }).should("have.length.gte", 1);
  // React Flow measures the nodes and places the handles over a few frames.
  cy.wait(800);
  cy.window().then((win) => into(collect(win)));
}

describe("every way of reading a diagram draws what the editor draws", () => {
  const editor: Record<string, Drawing> = {};
  const reading: Record<Surface, Record<string, Drawing>> = { diagramId: {}, data: {}, share: {} };
  let diagramIds: string[] = [];
  let sceneDiagramId = "";

  before(() => {
    cy.visit("/workspace", {
      onBeforeLoad(win) {
        win.localStorage.clear();
      },
    });
    // The seeds are written on the first load.
    cy.window({ timeout: 60000 }).should((win) => {
      const raw = win.localStorage.getItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY);
      expect(raw, "seeded store").to.be.a("string");
      const diagrams = JSON.parse(raw!).state?.diagrams ?? {};
      expect(Object.keys(diagrams)).to.have.length.greaterThan(0);
    });
    cy.window().then((win) => {
      const stored = JSON.parse(win.localStorage.getItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY)!);
      const diagrams = stored.state.diagrams as Record<string, StoredDiagram>;
      diagramIds = Object.keys(diagrams)
        .filter((id) => Object.keys(diagrams[id].nodeLayouts ?? {}).length >= 2)
        .sort();
      sceneDiagramId = diagramIds[0];
      openInScene(diagrams[sceneDiagramId]);
      win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, JSON.stringify(stored));
    });

    cy.then(() => {
      for (const id of diagramIds) {
        const links = { data: "", share: "" };
        drawingAt(`/model/${id}`, (drawing) => (editor[id] = drawing));
        cy.get('[data-testid="open-share-modal"]').click();
        cy.get('[data-testid="share-embed-url"]')
          .invoke("val")
          .then((value) => (links.data = String(value)));
        cy.get('[data-testid="share-link-url"]')
          .invoke("val")
          .then((value) => (links.share = String(value)));
        drawingAt(`/viewer?diagramId=${id}`, (drawing) => (reading.diagramId[id] = drawing));
        cy.then(() => drawingAt(links.data, (drawing) => (reading.data[id] = drawing)));
        cy.then(() => drawingAt(links.share, (drawing) => (reading.share[id] = drawing)));
      }
    });
  });

  it("covers every seed and opens one inside a scene", () => {
    expect(diagramIds.length).to.be.greaterThan(1);
    expect(sceneDiagramId).to.be.oneOf(diagramIds);
    for (const id of diagramIds) {
      expect(Object.keys(editor[id]?.nodes ?? {}), id).to.have.length.greaterThan(0);
    }
  });

  it("draws the scene the editor has open, not the base", () => {
    // The scene removed a component: the editor must not draw it, or the
    // comparisons below would pass on two pictures of the base.
    const drawn = Object.keys(editor[sceneDiagramId].nodes);
    cy.window().then((win) => {
      const stored = JSON.parse(win.localStorage.getItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY)!);
      const scene = stored.state.diagrams[sceneDiagramId].versions[SCENE_ID];
      expect(drawn).not.to.include(scene.removedComponentIds[0]);
    });
  });

  for (const surface of SURFACES) {
    it(`draws the same picture through ${surface}`, () => {
      const divergent = diagramIds.flatMap((id) =>
        differences(id, editor[id], reading[surface][id]),
      );
      expect(divergent, `${surface} draws differently:\n${divergent.join("\n")}`).to.have.length(0);
    });
  }
});
