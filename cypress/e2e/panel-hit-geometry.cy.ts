/**
 * Fase 4 — decisões #1 e #2: geometria de clique do painel.
 *
 * Por que esta spec existe separada da matriz: a matriz certificava a decisão
 * #1 com `cy.get(".panel-body").click({ force: true })`, e `force: true` manda
 * o Cypress ignorar a geometria e disparar o evento no elemento escolhido
 * mesmo que nada por cima o alcance. O teste passava enquanto o `.panel-body`
 * renderizava com 397x0 e todo clique real no interior caía no `.panel-border`
 * — que é `absolute inset-0`, ou seja, o painel inteiro — e selecionava o
 * painel. **Nenhum teste aqui usa `force`.** Onde um clique é preciso, o alvo
 * é o elemento que o `elementFromPoint` devolve, e o Cypress mantém suas
 * checagens de actionability: se algo cobrir o ponto, ou se o elemento tiver
 * colapsado para altura zero, o comando falha em vez de fingir.
 *
 * Mordida provada (ver o relatório da sessão):
 *  - `.panel-border` de volta para `absolute inset-0` → a grade e o clique no
 *    interior ficam vermelhos.
 *  - `.panel-body` de volta para altura zero → idem.
 */

const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";
const DIAGRAM_ID = "diag_panel_hit_geometry";

/** Largura do anel de clique em unidades de fluxo (`PANEL_BORDER_HIT_PX`). */
const BORDER_HIT_FLOW_PX = 8;
const ZOOM = 0.8;
/**
 * O anel é DOM, então escala com o zoom: 8 px de fluxo viram 6,4 px de tela a
 * 0,8. Amostramos a 3 px da borda — dentro do anel com folga em ambos os
 * sentidos, e fora dos 2 px de traço desenhado do container.
 */
const INSIDE_RING_PX = 3;

function buildPayload(): string {
  const now = new Date().toISOString();
  return JSON.stringify({
    state: {
      diagrams: {
        [DIAGRAM_ID]: {
          id: DIAGRAM_ID,
          name: "Panel Hit Geometry",
          domain: "",
          level: "context",
          description: "",
          snapshot: {
            components: {
              panel_big: {
                id: "panel_big",
                name: "Big Panel",
                description: "Painel grande para teste",
                parentId: null,
                type: "panel",
                panelKind: "default",
                panelColor: "#6366f1",
              },
              child_1: {
                id: "child_1",
                name: "Child 1",
                description: "",
                parentId: "panel_big",
                type: "system",
              },
              child_2: {
                id: "child_2",
                name: "Child 2",
                description: "",
                parentId: "panel_big",
                type: "system",
              },
              standalone_1: {
                id: "standalone_1",
                name: "Standalone 1",
                description: "",
                parentId: null,
                type: "system",
              },
            },
            connections: {},
            flows: {},
            iconLibrary: {},
          },
          nodeLayouts: {
            panel_big: { elementId: "panel_big", x: 300, y: 200, width: 500, height: 400 },
            child_1: { elementId: "child_1", x: 50, y: 80 },
            child_2: { elementId: "child_2", x: 250, y: 80 },
            standalone_1: { elementId: "standalone_1", x: 1100, y: 200 },
          },
          edgeLayouts: [],
          viewport: { x: 0, y: 0, zoom: ZOOM },
          scenes: {},
          createdAt: now,
          updatedAt: now,
        },
      },
      folders: {},
      userTemplates: {},
      serviceRegistry: {},
      activeDiagramId: DIAGRAM_ID,
      past: [],
      future: [],
      _lastUndoRedoAt: 0,
    },
    version: 11,
  });
}

/**
 * Every point below is a FUNCTION of the live document, never a frozen pair of
 * numbers. Cypress retries an assertion, not the expression that produced its
 * subject: `cy.hitRegionAt(x, y).should(...)` keeps re-checking coordinates
 * measured before the viewport finished settling, and reports a timing problem
 * as a geometry one. `cy.assertHitRegion(pointOf, ...)` re-measures each retry.
 */
type PointOf = (doc: Document) => [number, number];

const panelEl = (doc: Document) => doc.querySelector('[data-id="panel_big"]') as HTMLElement;
const panelRect = (doc: Document) => panelEl(doc).getBoundingClientRect();
const headerRect = (doc: Document) =>
  (panelEl(doc).querySelector(".panel-header") as HTMLElement).getBoundingClientRect();

/** First y below the header AND below both children — safely "empty interior". */
function interiorTop(doc: Document): number {
  const hr = headerRect(doc);
  const childBottoms = ["child_1", "child_2"].map((id) => {
    const el = doc.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
    return el ? el.getBoundingClientRect().bottom : hr.bottom;
  });
  return Math.max(hr.bottom, ...childBottoms) + 12;
}

/** A point given as offsets from the panel's top-left, both re-measured. */
const atPanel =
  (dx: (w: number) => number, dy: (h: number) => number): PointOf =>
  (doc) => {
    const r = panelRect(doc);
    return [r.left + dx(r.width), r.top + dy(r.height)];
  };

const headerPoint: PointOf = (doc) => {
  const hr = headerRect(doc);
  return [hr.left + hr.width * 0.5, hr.top + hr.height * 0.5];
};

const interiorPoint =
  (fx: (w: number) => number, extraY = 0): PointOf =>
  (doc) => {
    const r = panelRect(doc);
    return [r.left + fx(r.width), interiorTop(doc) + extraY];
  };

const childPoint =
  (id: string): PointOf =>
  (doc) => {
    const r = (doc.querySelector(`[data-id="${id}"]`) as HTMLElement).getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };

function selectedIds(): Cypress.Chainable<string[]> {
  return cy
    .document({ log: false })
    .then((doc) =>
      [...doc.querySelectorAll(".react-flow__node.selected")]
        .map((n) => n.getAttribute("data-id") ?? "")
        .sort(),
    );
}

/** A point on empty pane, far from every node in this fixture. */
const emptyPanePoint: PointOf = (doc) => {
  const r = (doc.querySelector(".react-flow__pane") as HTMLElement).getBoundingClientRect();
  return [r.left + r.width * 0.5, r.bottom - 40];
};

/** Só a parte translate do style — `z-index`/`visibility` mudam com seleção e culling. */
function translateOf(style: string | undefined): string {
  return /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(style ?? "")?.[0] ?? "(no translate)";
}

describe("Painel — geometria de clique (fase 4, decisões #1 e #2)", () => {
  beforeEach(() => {
    cy.visit(`/model/${DIAGRAM_ID}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, buildPayload());
        (win as unknown as { __structuraE2eDisableSnap?: boolean }).__structuraE2eDisableSnap =
          true;
      },
    });
    cy.waitForCanvas(4);
    // A seleção é estado de página e `testIsolation` está desligado no projeto:
    // começar de uma seleção herdada faria "não seleciona" passar por acidente.
    cy.assertHitRegion(emptyPanePoint, "pane", "o ponto de fundo da fixture");
    cy.clickAtPoint(emptyPanePoint);
    selectedIds().should("deep.equal", []);
  });

  describe("Caixas dos três alvos", () => {
    it("o corpo tem altura real e a borda é um anel, não o painel inteiro", () => {
      cy.document({ log: false }).should((doc) => {
        const panel = panelEl(doc);
        const r = panel.getBoundingClientRect();
        const bodyRect = (
          panel.querySelector(".panel-body") as HTMLElement
        ).getBoundingClientRect();

        // Mutação "corpo com altura zero" morre aqui.
        expect(bodyRect.height, ".panel-body must occupy the interior").to.be.greaterThan(
          r.height * 0.5,
        );

        const strips = [...panel.querySelectorAll(".panel-border")].map((el) =>
          el.getBoundingClientRect(),
        );
        expect(strips.length, ".panel-border is a ring of four strips").to.equal(4);
        // Mutação "borda com inset-0" morre aqui: a faixa passaria a ter a
        // altura E a largura do painel ao mesmo tempo.
        strips.forEach((st) => {
          expect(
            Math.min(st.width, st.height),
            "each ring strip must be thin in one axis",
          ).to.be.lessThan(BORDER_HIT_FLOW_PX * ZOOM + 2);
        });
      });
    });
  });

  describe("Grade de elementFromPoint (7x8 pontos, ponteiro real)", () => {
    const COLS: Array<(w: number) => number> = [
      () => INSIDE_RING_PX,
      () => 20,
      (w) => w * 0.25,
      (w) => w * 0.5,
      (w) => w * 0.75,
      (w) => w - 20,
      (w) => w - INSIDE_RING_PX,
    ];
    const ROWS: Array<(h: number) => number> = [
      () => INSIDE_RING_PX,
      () => 20,
      (h) => h * 0.4,
      (h) => h * 0.55,
      (h) => h * 0.7,
      (h) => h - 20,
      (h) => h - INSIDE_RING_PX,
    ];

    it("os quatro lados da faixa de 8 px pertencem ao .panel-border", () => {
      // Linha de cima e linha de baixo, todas as colunas.
      COLS.forEach((dx, i) => {
        [ROWS[0], ROWS[ROWS.length - 1]].forEach((dy, j) => {
          cy.assertHitRegion(atPanel(dx, dy), "panel-border", `col ${i} / ${j ? "base" : "topo"}`);
        });
      });
      // Coluna da esquerda e da direita, todas as linhas.
      ROWS.forEach((dy, i) => {
        [COLS[0], COLS[COLS.length - 1]].forEach((dx, j) => {
          cy.assertHitRegion(
            atPanel(dx, dy),
            "panel-border",
            `row ${i} / ${j ? "direita" : "esquerda"}`,
          );
        });
      });
    });

    it("a faixa do título pertence ao .panel-header", () => {
      cy.assertHitRegion(headerPoint, "panel-header", "centro do cabeçalho");
      [0.25, 0.5, 0.75].forEach((f) => {
        cy.assertHitRegion(
          (doc) => {
            const r = panelRect(doc);
            const hr = headerRect(doc);
            return [r.left + r.width * f, hr.top + hr.height * 0.5];
          },
          "panel-header",
          `título a ${f * 100}% da largura`,
        );
      });
    });

    it("o interior vazio pertence ao .panel-body — nunca ao .panel-border", () => {
      const xs: Array<(w: number) => number> = [
        (w) => w * 0.25,
        (w) => w * 0.5,
        (w) => w * 0.75,
        () => 20,
        (w) => w - 20,
      ];
      const extraYs = [0, 40, 80];
      extraYs.forEach((extra) => {
        xs.forEach((fx, i) => {
          cy.assertHitRegion(
            interiorPoint(fx, extra),
            "panel-body",
            `interior col ${i} +${extra}px`,
          );
        });
      });
    });

    it("um ponto sobre um filho pertence ao filho", () => {
      cy.assertHitRegion(childPoint("child_1"), "node:child_1");
    });
  });

  describe("Clique real, sem force", () => {
    it("o cabeçalho seleciona o painel", () => {
      cy.assertHitRegion(headerPoint, "panel-header");
      cy.clickAtPoint(headerPoint);
      selectedIds().should("deep.equal", ["panel_big"]);
    });

    it("cada um dos quatro lados da borda seleciona o painel", () => {
      const sides: Array<[string, PointOf]> = [
        [
          "topo",
          atPanel(
            (w) => w * 0.5,
            () => INSIDE_RING_PX,
          ),
        ],
        [
          "baixo",
          atPanel(
            (w) => w * 0.5,
            (h) => h - INSIDE_RING_PX,
          ),
        ],
        [
          "esquerda",
          atPanel(
            () => INSIDE_RING_PX,
            (h) => h * 0.7,
          ),
        ],
        [
          "direita",
          atPanel(
            (w) => w - INSIDE_RING_PX,
            (h) => h * 0.7,
          ),
        ],
      ];
      sides.forEach(([name, point]) => {
        cy.clickAtPoint(emptyPanePoint);
        selectedIds().should("deep.equal", []);
        cy.assertHitRegion(point, "panel-border", `borda ${name}`);
        cy.clickAtPoint(point);
        selectedIds().should("deep.equal", ["panel_big"], `borda ${name}`);
      });
    });

    it("o clique no interior NÃO seleciona o painel (decisão #1)", () => {
      const point = interiorPoint((w) => w * 0.5);
      cy.assertHitRegion(point, "panel-body");
      cy.clickAtPoint(point);
      selectedIds().should("deep.equal", []);
    });

    it("o clique no interior LIMPA a seleção — a queixa original do dono do produto", () => {
      cy.clickAtPoint(headerPoint);
      selectedIds().should("deep.equal", ["panel_big"]);
      const point = interiorPoint((w) => w * 0.5);
      cy.assertHitRegion(point, "panel-body");
      cy.clickAtPoint(point);
      selectedIds().should("deep.equal", []);
    });

    it("o clique no interior limpa a seleção de OUTRO elemento também", () => {
      cy.clickAtPoint(childPoint("child_1"));
      selectedIds().should("deep.equal", ["child_1"]);
      cy.clickAtPoint(interiorPoint((w) => w * 0.5));
      selectedIds().should("deep.equal", []);
    });

    it("o clique num filho seleciona o filho, não o painel", () => {
      cy.clickAtPoint(childPoint("child_2"));
      selectedIds().should("deep.equal", ["child_2"]);
    });
  });

  describe("Arraste real, sem force", () => {
    /** Drags between two live points and hands back the before/after translate. */
    function dragBetween(from: PointOf, to: (doc: Document) => [number, number]) {
      return cy
        .getNode("panel_big")
        .invoke("attr", "style")
        .then((before) => {
          cy.document({ log: false }).then((doc) => {
            const [x0, y0] = from(doc);
            const [x1, y1] = to(doc);
            cy.dragFromPoint(x0, y0, x1, y1);
          });
          return cy.wrap(translateOf(before), { log: false });
        });
    }

    it("o arraste pelo cabeçalho move o painel (decisão #2)", () => {
      cy.assertHitRegion(headerPoint, "panel-header");
      dragBetween(headerPoint, (doc) => {
        const [x, y] = headerPoint(doc);
        return [x + 120, y];
      }).then((before) => {
        cy.getNode("panel_big")
          .invoke("attr", "style")
          .should((after) => {
            expect(translateOf(after), "panel must move when dragged by the header").to.not.equal(
              before,
            );
          });
      });
    });

    it("o arraste pela borda move o painel (decisão #2 — dragHandle inclui o anel)", () => {
      const ring = atPanel(
        () => INSIDE_RING_PX,
        (h) => h * 0.7,
      );
      cy.assertHitRegion(ring, "panel-border");
      dragBetween(ring, (doc) => {
        const [x, y] = ring(doc);
        return [x + 120, y];
      }).then((before) => {
        cy.getNode("panel_big")
          .invoke("attr", "style")
          .should((after) => {
            expect(translateOf(after), "panel must move when dragged by the ring").to.not.equal(
              before,
            );
          });
      });
    });

    it("o arraste pelo interior NÃO move o painel", () => {
      const from = interiorPoint((w) => w * 0.3, 20);
      cy.assertHitRegion(from, "panel-body");
      dragBetween(from, (doc) => {
        const [x, y] = from(doc);
        return [x + 150, y + 80];
      }).then((before) => {
        cy.getNode("panel_big")
          .invoke("attr", "style")
          .should((after) => {
            expect(translateOf(after), "panel must NOT move when dragged by its interior").to.equal(
              before,
            );
          });
      });
    });

    it("o arraste pelo interior desenha o retângulo de seleção", () => {
      const from = atPanel(
        (w) => w * 0.3,
        (h) => h - 20,
      );
      cy.assertHitRegion(from, "panel-body");

      // O retângulo só existe DURANTE o gesto, então amostramos no meio dele em
      // vez de olhar o resultado: olhar só o resultado deixaria "0 frames de
      // marquee" passar por qualquer outro caminho que mudasse a seleção.
      const frames: string[] = [];
      cy.window({ log: false }).then((win) => {
        const id = win.setInterval(() => {
          const rect = win.document.querySelector(".react-flow__selection");
          if (rect) {
            const r = rect.getBoundingClientRect();
            frames.push(`${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        }, 20);
        cy.document({ log: false }).then((doc) => {
          const [x0, y0] = from(doc);
          const [x1, y1] = [panelRect(doc).left + panelRect(doc).width * 0.8, interiorTop(doc)];
          cy.dragFromPoint(x0, y0, x1, y1);
        });
        cy.then(() => win.clearInterval(id));
      });
      cy.then(() => {
        expect(
          frames.length,
          "a marquee rectangle must be on screen during a drag from the panel interior",
        ).to.be.greaterThan(0);
      });
    });
  });
});
