/**
 * Rendered parity: `/model/:id` and `/viewer?diagramId=:id` have to draw the
 * same picture, in pixels.
 *
 * `core/readWriteParity.test.tsx` already compares the two *projections*, and it
 * passes — both produce identical node objects, because neither carries a
 * height. A card is sized by its content, and the reader zeroes `services` and
 * `allDiagrams` (`buildReadNodeContext`), so the service chip and the "explore
 * inside" row vanish and the same card comes out ~70px shorter. Auto-layout
 * anchors every waypoint at a fraction of the height it was given, so the
 * handles then sit where the corridor does not reach. That divergence exists
 * only after the DOM, which is why it needs a test at this altitude.
 *
 * The seed is built to make both failures reachable:
 *  - `linked` carries `linkedDiagramId` + `serviceId`, so the editor draws two
 *    rows the reader cannot (it does not have the names), and `nodeLayouts`
 *    gives it the height the layout measured;
 *  - the stamped corridor sits a fraction of a pixel off the handle's row, the
 *    way ELK's rounded boxes leave it, so an edge that turns *after* it arrives
 *    ends on a sliver of a vertical and spins its arrowhead.
 */
const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";
const DIAGRAM_ID = "diag_render_parity";
const LINKED_DIAGRAM_ID = "diag_render_parity_linked";
const SERVICE_ID = "svc_render_parity";

/** Below this, two coordinates are the same point: float noise, not a difference. */
const TOLERANCE_PX = 0.01;

/** The height the "layout" measured for the linked card — taller than its content. */
const LINKED_HEIGHT = 180;
/** How far the stamped corridor sits off the handle's row, as ELK's rounding leaves it. */
const CORRIDOR_DRIFT = 0.6640625;

interface Point {
  x: number;
  y: number;
}

/** Every `d` on the canvas, keyed by edge id. */
function collectEdgePaths(win: Window): Record<string, string> {
  const out: Record<string, string> = {};
  win.document.querySelectorAll(".react-flow__edge").forEach((edge) => {
    const path = edge.querySelector(".react-flow__edge-path");
    const id = edge.getAttribute("data-id");
    if (path && id) out[id] = path.getAttribute("d") ?? "";
  });
  return out;
}

/** Every node's box in flow units, keyed by component id. */
function collectNodeBoxes(win: Window): Record<string, { w: number; h: number }> {
  const viewport = win.document.querySelector(".react-flow__viewport") as HTMLElement | null;
  const matrix = viewport && /matrix\(([^)]+)\)/.exec(win.getComputedStyle(viewport).transform);
  const zoom = matrix ? Number(matrix[1].split(",")[0]) : 1;
  const out: Record<string, { w: number; h: number }> = {};
  win.document.querySelectorAll(".react-flow__node").forEach((node) => {
    const id = node.getAttribute("data-id");
    // The card, not React Flow's wrapper: the handles are placed against it.
    const card = node.firstElementChild;
    if (!id || !card) return;
    const rect = card.getBoundingClientRect();
    out[id] = { w: rect.width / zoom, h: rect.height / zoom };
  });
  return out;
}

/**
 * The points an H/V path actually visits.
 *
 * Compare these, never the `d` string: the two surfaces emit a different number
 * of commands for the same shape — a turn that is a no-op on one side is a
 * sliver on the other — and they differ in the last float digit besides. A
 * string compare reports every edge as divergent while the picture is identical.
 */
function visitedPoints(d: string): Point[] {
  const tokens = d.trim().split(/\s+/);
  const points: Point[] = [];
  let current: Point = { x: 0, y: 0 };
  for (let i = 0; i < tokens.length;) {
    if (tokens[i] === "M") {
      current = { x: Number(tokens[i + 1]), y: Number(tokens[i + 2]) };
      points.push(current);
      i += 3;
    } else if (tokens[i] === "H") {
      const x = Number(tokens[i + 1]);
      if (Math.abs(x - current.x) > TOLERANCE_PX) points.push((current = { x, y: current.y }));
      i += 2;
    } else if (tokens[i] === "V") {
      const y = Number(tokens[i + 1]);
      if (Math.abs(y - current.y) > TOLERANCE_PX) points.push((current = { x: current.x, y }));
      i += 2;
    } else {
      i += 1;
    }
  }
  return points;
}

function buildPayload(): string {
  const plain = {
    id: "cmp_plain",
    name: "Plain",
    description: "No chips, no linked diagram.",
    parentId: null,
    type: "container",
    technology: "Go",
  };
  // Two rows the reader cannot draw: it has neither the service name nor the
  // linked diagram's name, so this card is shorter there unless the box is declared.
  const linked = {
    id: "cmp_linked",
    name: "Linked",
    description: "Points at another diagram and carries a service.",
    parentId: null,
    type: "container",
    technology: "Go / gRPC",
    serviceId: SERVICE_ID,
    linkedDiagramId: LINKED_DIAGRAM_ID,
  };

  const linkedY = 200;
  // The handle the single incoming edge lands on: half way down the declared box.
  const handleY = linkedY + LINKED_HEIGHT / 2;

  const diagram = {
    id: DIAGRAM_ID,
    name: "Render Parity",
    domain: "",
    level: "container",
    description: "",
    snapshot: {
      components: { [plain.id]: plain, [linked.id]: linked },
      connections: {
        conn_parity: {
          id: "conn_parity",
          sourceId: plain.id,
          targetId: linked.id,
          label: "calls",
          style: { edgeStyle: "editable-step" },
        },
      },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      [plain.id]: { elementId: plain.id, x: 100, y: 200, width: 260, height: 120 },
      [linked.id]: {
        elementId: linked.id,
        x: 700,
        y: linkedY,
        width: 260,
        height: LINKED_HEIGHT,
      },
    },
    edgeLayouts: {
      conn_parity: {
        points: [
          { id: "cp_a", x: 420, y: handleY + CORRIDOR_DRIFT },
          { id: "cp_b", x: 620, y: handleY + CORRIDOR_DRIFT },
        ],
      },
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    versions: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const linkedDiagram = {
    ...diagram,
    id: LINKED_DIAGRAM_ID,
    name: "The Linked One",
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
  };

  return JSON.stringify({
    state: {
      diagrams: { [DIAGRAM_ID]: diagram, [LINKED_DIAGRAM_ID]: linkedDiagram },
      folders: {},
      userTemplates: {},
      services: {
        [SERVICE_ID]: { id: SERVICE_ID, name: "billing-service", description: "" },
      },
      activeDiagramId: DIAGRAM_ID,
      past: [],
      future: [],
      _lastUndoRedoAt: 0,
    },
    version: 4,
  });
}

function visitAndCollect(
  url: string,
  into: { paths: Record<string, string>; boxes: Record<string, { w: number; h: number }> },
) {
  cy.visit(url, {
    onBeforeLoad(win) {
      win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, buildPayload());
    },
  });
  cy.get(".react-flow__node", { timeout: 60000 }).should("have.length.gte", 2);
  cy.get(".react-flow__edge-path", { timeout: 20000 }).should("have.length.gte", 1);
  // One frame for React Flow to measure the nodes and place the handles.
  cy.wait(500);
  cy.window().then((win) => {
    into.paths = collectEdgePaths(win);
    into.boxes = collectNodeBoxes(win);
  });
}

describe("editor and viewer draw the same picture", () => {
  const editor = { paths: {}, boxes: {} } as {
    paths: Record<string, string>;
    boxes: Record<string, { w: number; h: number }>;
  };
  const viewer = { paths: {}, boxes: {} } as {
    paths: Record<string, string>;
    boxes: Record<string, { w: number; h: number }>;
  };

  before(() => {
    visitAndCollect(`/model/${DIAGRAM_ID}`, editor);
    visitAndCollect(`/viewer?diagramId=${DIAGRAM_ID}`, viewer);
  });

  it("gives a card the same box on both surfaces", () => {
    expect(Object.keys(editor.boxes)).to.have.length.greaterThan(0);
    const divergent = Object.keys(editor.boxes)
      .map((id) => ({ id, a: editor.boxes[id], b: viewer.boxes[id] }))
      .filter(
        ({ a, b }) =>
          !b || Math.abs(a.w - b.w) > TOLERANCE_PX || Math.abs(a.h - b.h) > TOLERANCE_PX,
      )
      .map(({ id, a, b }) => `${id}: editor ${a.w}x${a.h} vs viewer ${b?.w}x${b?.h}`);

    expect(divergent, `nodes measured differently:\n${divergent.join("\n")}`).to.have.length(0);
  });

  it("declares the box the layout measured, rather than shrinking to content", () => {
    expect(editor.boxes.cmp_linked.h).to.be.at.least(LINKED_HEIGHT - TOLERANCE_PX);
    expect(viewer.boxes.cmp_linked.h).to.be.at.least(LINKED_HEIGHT - TOLERANCE_PX);
  });

  it("routes every edge through the same points on both surfaces", () => {
    expect(Object.keys(editor.paths)).to.have.length.greaterThan(0);
    const divergent: string[] = [];
    for (const id of Object.keys(editor.paths)) {
      const a = visitedPoints(editor.paths[id]);
      const b = visitedPoints(viewer.paths[id] ?? "");
      if (a.length !== b.length) {
        divergent.push(`${id}: ${a.length} points vs ${b.length}`);
        continue;
      }
      for (let i = 0; i < a.length; i += 1) {
        if (Math.abs(a[i].x - b[i].x) > TOLERANCE_PX || Math.abs(a[i].y - b[i].y) > TOLERANCE_PX) {
          divergent.push(`${id}[${i}]: (${a[i].x}, ${a[i].y}) vs (${b[i].x}, ${b[i].y})`);
        }
      }
    }
    expect(divergent, `edges routed differently:\n${divergent.join("\n")}`).to.have.length(0);
  });

  it("arrives horizontally, so the arrowhead points into the handle", () => {
    // `marker-end` with orient="auto" takes its angle from the last segment. The
    // seed puts the corridor off the handle's row on purpose: a path that turns
    // after it arrives ends on that sliver and the arrowhead swings 90°.
    for (const [surface, collected] of [
      ["editor", editor],
      ["viewer", viewer],
    ] as const) {
      for (const [id, d] of Object.entries(collected.paths)) {
        const points = visitedPoints(d);
        const last = points[points.length - 1];
        const previous = points[points.length - 2];
        expect(
          Math.abs(last.y - previous.y),
          `${surface} ${id} ends on a vertical: (${previous.x}, ${previous.y}) -> (${last.x}, ${last.y})`,
        ).to.be.lessThan(TOLERANCE_PX);
      }
    }
  });
});
