/**
 * Phase 1 — Mapa Comportamental: Seleção de nós e arestas
 * Testes focados nas duas hipóteses centrais:
 * H1: "Clicar no fundo não desseleciona" - pode ser corpo de painel, não fundo real
 * H2: "Seleciono sem querer ao arrastar" - pode ser falta de limiar de arraste
 */

const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";
const DIAGRAM_ID = "diag_selection_test";

function buildSelectionTestPayload(): string {
  const components = {
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
      description: "Nó solto",
      parentId: null,
      type: "system",
    },
    standalone_2: {
      id: "standalone_2",
      name: "Standalone 2",
      description: "Nó solto 2",
      parentId: null,
      type: "system",
    },
    /*
     * Phase 4 — threshold tests: this node sits 3 px off the 15 px grid
     * (102, 703) so that a 3 px move triggers the snap-to-grid jump that
     * originally hid the broken 3 px threshold in `useLocalNodes`.
     */
    standalone_offset: {
      id: "standalone_offset",
      name: "Standalone Offset",
      description: "Three pixels off the 15 px grid",
      parentId: null,
      type: "system",
    },
  };

  const connections = {
    edge_1: {
      id: "edge_1",
      sourceId: "child_1",
      targetId: "child_2",
      label: "uses",
      style: {},
    },
  };

  const nodeLayouts = {
    panel_big: { elementId: "panel_big", x: 300, y: 200, width: 500, height: 400 },
    child_1: { elementId: "child_1", x: 50, y: 80 },
    child_2: { elementId: "child_2", x: 250, y: 80 },
    standalone_1: { elementId: "standalone_1", x: 100, y: 700 },
    standalone_2: { elementId: "standalone_2", x: 900, y: 700 },
    standalone_offset: { elementId: "standalone_offset", x: 102, y: 703 },
  };

  return JSON.stringify({
    state: {
      diagrams: {
        [DIAGRAM_ID]: {
          id: DIAGRAM_ID,
          name: "Selection Test",
          domain: "",
          level: "context",
          description: "Teste de seleção",
          snapshot: { components, connections, flows: {}, iconLibrary: {} },
          nodeLayouts,
          edgeLayouts: [],
          viewport: { x: 0, y: 0, zoom: 0.8 },
          scenes: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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

function renderedTranslate(style: string | undefined): { x: number; y: number } {
  const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(style ?? "");
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: NaN, y: NaN };
}

describe("Phase 1 — Seleção: Hipóteses Centrais", () => {
  beforeEach(() => {
    cy.visit(`/model/${DIAGRAM_ID}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, buildSelectionTestPayload());
      },
    });
    cy.waitForCanvas(5);
  });

  // ============================================================
  // H1: CLIQUE NO FUNDO VS CORPO DE PAINEL
  // ============================================================

  describe("H1: Clicar no fundo não desseleciona", () => {
    it("H1a: Clique em área realmente vazia (longe de painéis) limpa seleção", () => {
      // Selecionar algo
      cy.getNode("standalone_1").click({ force: true });
      cy.getNode("standalone_1").should("have.class", "selected");

      // Clicar em área vazia longe de tudo (y=900 deve estar vazio)
      cy.get(".react-flow__pane").click(100, 900, { force: true });

      // Verificar que nenhum nó está selecionado
      cy.get(".react-flow__node.selected", { timeout: 3000 }).should("not.exist");
    });

    it("H1b: Clique diretamente no painel seleciona o painel", () => {
      // Clicar diretamente no nó do painel
      cy.getNode("panel_big").click({ force: true });

      // O painel deve estar selecionado
      cy.getNode("panel_big").should("have.class", "selected");
    });

    it("H1c: Clique em child dentro de painel funciona", () => {
      // Clicar em um filho
      cy.getNode("child_1").click({ force: true });
      cy.getNode("child_1").should("have.class", "selected");
    });
  });

  // ============================================================
  // H2: SELEÇÃO ACIDENTAL AO ARRASTAR
  // ============================================================

  describe("H2: Seleciono sem querer ao arrastar", () => {
    it("H2a: Arraste de 3px move o nó?", () => {
      cy.getNode("standalone_1")
        .invoke("attr", "style")
        .then((before) => {
          const startPos = renderedTranslate(before as string);

          cy.dragNode("standalone_1", 3, 3);

          cy.getNode("standalone_1")
            .invoke("attr", "style")
            .then((after) => {
              const afterPos = renderedTranslate(after as string);
              const movedX = Math.abs(afterPos.x - startPos.x);
              const movedY = Math.abs(afterPos.y - startPos.y);
              cy.log(`Arraste de 3px: deltaX=${movedX.toFixed(1)}, deltaY=${movedY.toFixed(1)}`);

              // Documenta: se moved > 1, não há limiar de arraste
              expect(movedX > 1 || movedY > 1, "nó deve ter se movido com 3px").to.be.true;
            });
        });
    });

    it("H2b: Arraste de 1px NÃO move o nó (limiar de 4 px — decisão #4)", () => {
      cy.getNode("standalone_1")
        .invoke("attr", "style")
        .then((before) => {
          cy.dragNodeAllowingNoMove("standalone_1", 1, 1);
          cy.getNode("standalone_1")
            .invoke("attr", "style")
            .should((after) => {
              expect(after, "nó NÃO deve ter se movido com apenas 1 px").to.equal(before);
            });
        });
    });

    it("H2c: Arraste de 2px NÃO move o nó (limiar de 4 px — decisão #4)", () => {
      cy.getNode("standalone_1")
        .invoke("attr", "style")
        .then((before) => {
          cy.dragNodeAllowingNoMove("standalone_1", 2, 2);
          cy.getNode("standalone_1")
            .invoke("attr", "style")
            .should((after) => {
              expect(after, "nó NÃO deve ter se movido com apenas 2 px").to.equal(before);
            });
        });
    });

    it("H2c: Arraste normal (50px) funciona", () => {
      cy.getNode("standalone_1")
        .invoke("attr", "style")
        .then((before) => {
          const startPos = renderedTranslate(before as string);

          cy.dragNode("standalone_1", 50, 30);

          cy.getNode("standalone_1")
            .invoke("attr", "style")
            .then((after) => {
              const afterPos = renderedTranslate(after);
              expect(afterPos.x, "nó deve ter se movido ~50px").to.be.greaterThan(startPos.x + 40);
            });
        });
    });
  });

  // ============================================================
  // CLIQUES BÁSICOS
  // ============================================================

  describe("Cliques básicos", () => {
    it("clique em nó solto seleciona", () => {
      cy.getNode("standalone_1").click({ force: true });
      cy.getNode("standalone_1").should("have.class", "selected");
    });

    it("clique em nó substitui seleção", () => {
      cy.getNode("standalone_1").click({ force: true });
      cy.getNode("standalone_2").click({ force: true });

      cy.getNode("standalone_2").should("have.class", "selected");
      cy.getNode("standalone_1").should("not.have.class", "selected");
    });

    it("Ctrl+click adiciona à seleção", () => {
      // Primeiro verificar que standalone_1 não está selecionado
      cy.getNode("standalone_1").click({ force: true });
      cy.getNode("standalone_1").should("have.class", "selected");

      // Desselecionar para testar Ctrl+click
      cy.get(".react-flow__pane").click(100, 900, { force: true });
      cy.get(".react-flow__node.selected").should("not.exist");

      // Ctrl+click em standalone_1
      cy.getNode("standalone_1").click({ ctrlKey: true, force: true });

      // Verificar se ficou selecionado
      cy.getNode("standalone_1").should(($el) => {
        const hasSelected =
          $el.hasClass("selected") ||
          $el.attr("aria-selected") === "true" ||
          $el[0]?.classList.contains("selected");
        expect(hasSelected, "standalone_1 deve estar selecionado após Ctrl+click").to.be.true;
      });
    });

    it("Esc limpa seleção", () => {
      cy.getNode("standalone_1").click({ force: true });
      cy.get("body").type("{esc}");

      cy.get(".react-flow__node.selected", { timeout: 3000 }).should("not.exist");
    });

    it("Delete remove nó selecionado", () => {
      cy.getNode("standalone_1").click({ force: true });
      cy.get("body").type("{del}");

      cy.getNode("standalone_1", { timeout: 3000 }).should("not.exist");
    });
  });

  // ============================================================
  // ARRASTE DE MÚLTIPLA SELEÇÃO (DRAW.IO PARITY)
  // ============================================================

  describe("Arraste com seleção múltipla (draw.io parity)", () => {
    it("arrastar um nó de seleção múltipla move todos", () => {
      // Criar seleção múltipla
      cy.getNode("standalone_1").click({ force: true });
      cy.getNode("standalone_2").click({ metaKey: true, force: true });

      // Arrastar standalone_1
      cy.getNode("standalone_1")
        .invoke("attr", "style")
        .then((before1) => {
          const startPos1 = renderedTranslate(before1 as string);
          cy.getNode("standalone_2")
            .invoke("attr", "style")
            .then((before2) => {
              const startPos2 = renderedTranslate(before2 as string);

              cy.dragNode("standalone_1", 100, 50);

              cy.getNode("standalone_1")
                .invoke("attr", "style")
                .should((after1) => {
                  const afterPos1 = renderedTranslate(after1 as string);
                  expect(afterPos1.x, "standalone_1 deve ter se movido").to.be.greaterThan(
                    startPos1.x,
                  );
                });

              cy.getNode("standalone_2")
                .invoke("attr", "style")
                .then((after2) => {
                  const afterPos2 = renderedTranslate(after2 as string);
                  const alsoMoved = afterPos2.x > startPos2.x;
                  cy.log(`standalone_2 também moveu na multi-seleção: ${alsoMoved}`);
                  // Ambos os nós devem ter se movido na multi-seleção
                });
            });
        });
    });

    it("arrastar nó NÃO selecionado SUBSTITUI seleção (decisão #3 — Figma/Miro)", () => {
      // Selecionar standalone_1
      cy.getNode("standalone_1").click({ force: true });
      cy.getNode("standalone_1").should("have.class", "selected");

      // Arrastar standalone_2 (não selecionado) — decisão #3: REPLACE.
      // O nó arrastado passa a ser o único selecionado (não soma).
      cy.dragNode("standalone_2", 100, 50);
      cy.wait(50);

      // Verificar que SÓ standalone_2 está na seleção (não standalone_1).
      cy.get(".react-flow__node.selected").then(($nodes) => {
        const selectedIds = Array.from($nodes).map((n) => n.getAttribute("data-id"));
        cy.log(`Nós selecionados após drag unselected: ${JSON.stringify(selectedIds)}`);
        expect(selectedIds, "apenas standalone_2 deve estar selecionado").to.deep.equal([
          "standalone_2",
        ]);
      });
    });

    it("Shift+arrastar nó NÃO selecionado ADICIONA à seleção (decisão #3 + #6)", () => {
      // Selecionar standalone_1
      cy.getNode("standalone_1").click({ force: true });
      cy.getNode("standalone_1").should("have.class", "selected");

      // Shift+arrastar standalone_2 — decisão #3, parte Shift: SOMA.
      // We must fire a keydown for Shift BEFORE the mousedown so React
      // Flow's `useKeyPress(multiSelectionKeyCode)` flips
      // `multiSelectionActive=true` — only then does RF's
      // `handleNodeClick` toggle selection instead of replacing it. Then
      // keyup Shift after mouseup so subsequent tests are not poisoned.
      cy.get("body").type("{shift}", { release: false });
      cy.window().then((win) => {
        cy.getNode("standalone_2").then(($node) => {
          const el = $node[0];
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const startX = rect.left + rect.width / 2;
          const startY = rect.top + rect.height / 2;
          const steps = 6;
          const dx = 60;
          const dy = 0;

          cy.wrap(el).trigger("mousedown", {
            clientX: startX,
            clientY: startY,
            button: 0,
            buttons: 1,
            shiftKey: true,
            view: win,
            force: true,
          });
          cy.then(() => {
            const appWindow = win as unknown as {
              MouseEvent: typeof MouseEvent;
              dispatchEvent: (event: Event) => boolean;
            };
            for (let i = 1; i <= steps; i += 1) {
              appWindow.dispatchEvent(
                new appWindow.MouseEvent("mousemove", {
                  clientX: startX + (dx * i) / steps,
                  clientY: startY + (dy * i) / steps,
                  button: 0,
                  buttons: 1,
                  bubbles: true,
                  cancelable: true,
                  shiftKey: true,
                  view: win as unknown as Window,
                }),
              );
            }
            appWindow.dispatchEvent(
              new appWindow.MouseEvent("mouseup", {
                clientX: startX + dx,
                clientY: startY + dy,
                button: 0,
                buttons: 0,
                bubbles: true,
                cancelable: true,
                shiftKey: true,
                view: win as unknown as Window,
              }),
            );
          });
        });
      });
      cy.get("body").type("{shift}", { release: true });
      cy.wait(200);

      // Both standalone_1 and standalone_2 must be selected.
      cy.get(".react-flow__node.selected").then(($nodes) => {
        const selectedIds = Array.from($nodes).map((n) => n.getAttribute("data-id"));
        cy.log(`Nós selecionados após Shift+drag: ${JSON.stringify(selectedIds)}`);
        expect(
          selectedIds,
          "ambos standalone_1 e standalone_2 devem estar selecionados",
        ).to.include("standalone_1");
        expect(
          selectedIds,
          "ambos standalone_1 e standalone_2 devem estar selecionados",
        ).to.include("standalone_2");
      });
    });
  });

  // ============================================================
  // PHASE 4 — DECISION #4 (drag threshold)
  //
  // These tests run with snap-to-grid DISABLED, and that is the whole point.
  //
  // With `snapGrid=[15, 15]` on, React Flow quantises the node position, so any
  // drag shorter than half a grid step leaves the rendered transform byte-for-
  // byte identical — whether or not `DRAG_THRESHOLD_PX` gated it. The previous
  // version of these tests asserted exactly that identity and was therefore
  // unfalsifiable: mutating `DRAG_THRESHOLD_PX` to 0 kept both "3 px does not
  // move" cases green. That is the same failure mode as the defect this phase
  // exists to fix — a threshold declared working on the strength of a test that
  // never exercised it — so it is reproduced here deliberately in the comment
  // rather than left as a footnote.
  //
  // `__structuraE2eDisableSnap` (see `canvas.constants.ts`) turns snapping off
  // for the fixture only. Distances: 3 px under the 4 px threshold, 10 px over
  // it. 10 px is chosen inside the 8–14 px window — comfortably clear of the
  // borderline (the old 4 px cases were flaky exactly because 4 is the limit)
  // and still under one 15 px grid step, so if snapping ever came back on these
  // assertions would go red instead of silently passing again.
  //
  // As asserções comparam apenas o `translate(...)` renderizado, não o atributo
  // `style` inteiro: `z-index` e `visibility` mudam por conta de seleção e de
  // culling de viewport, e comparar a string toda fazia o teste reagir a ruído
  // que nada tem a ver com o limiar.
  //
  // Mutation-break, verified:
  //  - `DRAG_THRESHOLD_PX = 0`   → the two "3 px NÃO move" cases go red.
  //  - `DRAG_THRESHOLD_PX = 999` → the two "10 px move" cases go red.
  // ============================================================
  describe("Phase 4 — Limiar de arraste (decisão #4)", () => {
    beforeEach(() => {
      cy.visit(`/model/${DIAGRAM_ID}`, {
        onBeforeLoad(win) {
          win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, buildSelectionTestPayload());
          (win as unknown as { __structuraE2eDisableSnap?: boolean }).__structuraE2eDisableSnap =
            true;
        },
      });
      cy.waitForCanvas(5);
    });

    it("3 px arraste num nó alinhado NÃO move (snap desligado)", () => {
      cy.getNode("standalone_1")
        .invoke("attr", "style")
        .then((before) => {
          cy.dragNodeAllowingNoMove("standalone_1", 3, 0);
          cy.getNode("standalone_1")
            .invoke("attr", "style")
            .should((after) => {
              const antes = renderedTranslate(before as string);
              const depois = renderedTranslate(after as string);
              expect(
                `${depois.x},${depois.y}`,
                "3 px está abaixo do limiar de 4 px — o nó NÃO deve se mover, e com snap desligado essa afirmação é falsificável",
              ).to.equal(`${antes.x},${antes.y}`);
            });
        });
    });

    it("3 px arraste num nó fora da grade NÃO move (snap desligado — regressão do bug original)", () => {
      cy.getNode("standalone_offset")
        .invoke("attr", "style")
        .then((before) => {
          cy.dragNodeAllowingNoMove("standalone_offset", 3, 0);
          cy.getNode("standalone_offset")
            .invoke("attr", "style")
            .should((after) => {
              const antes = renderedTranslate(before as string);
              const depois = renderedTranslate(after as string);
              expect(
                `${depois.x},${depois.y}`,
                "nó fora da grade NÃO deve se mover com 3 px — esta é a regressão que o commit 18af7ed deixou passar",
              ).to.equal(`${antes.x},${antes.y}`);
            });
        });
    });

    it("10 px arraste num nó alinhado move (snap desligado)", () => {
      cy.getNode("standalone_1")
        .invoke("attr", "style")
        .then((before) => {
          cy.dragNodeAllowingNoMove("standalone_1", 10, 0);
          cy.getNode("standalone_1")
            .invoke("attr", "style")
            .should((after) => {
              const antes = renderedTranslate(before as string);
              const depois = renderedTranslate(after as string);
              expect(
                `${depois.x},${depois.y}`,
                "10 px está acima do limiar — o nó deve se mover",
              ).to.not.equal(`${antes.x},${antes.y}`);
            });
        });
    });

    it("10 px arraste num nó fora da grade move (snap desligado)", () => {
      // A versão anterior deste caso afirmava
      //   [beforeStyle.includes("translate(102px"), ...].some(Boolean)
      // e o primeiro termo é verdadeiro por construção — o nó começa em 102.
      // A asserção nunca podia falhar. Com o snap desligado não é mais preciso
      // hedge nenhum: o arrasto chega inteiro no transform renderizado.
      cy.getNode("standalone_offset")
        .invoke("attr", "style")
        .then((before) => {
          cy.dragNodeAllowingNoMove("standalone_offset", 10, 0);
          cy.getNode("standalone_offset")
            .invoke("attr", "style")
            .should((after) => {
              const antes = renderedTranslate(before as string);
              const depois = renderedTranslate(after as string);
              expect(
                `${depois.x},${depois.y}`,
                "nó fora da grade deve se mover com 10 px",
              ).to.not.equal(`${antes.x},${antes.y}`);
            });
        });
    });
  });

  // ============================================================
  // PHASE 4 — DECISIONS #1 + #2 (panel body / header / border)
  //
  // The PanelNode exposes three named hit regions:
  //   - `.panel-header`  — drag handle, and a select target on click
  //   - `.panel-border`  — 8 px ring, also a drag handle and a select target
  //   - `.panel-body`    — the interior; behaves as canvas background
  //
  // These used to click with `force: true`, which is precisely what let the
  // decision-#1 case pass for months against a `.panel-body` that laid out at
  // 397x0 and never received a real pointer event. The full geometry proof
  // lives in `panel-hit-geometry.cy.ts`; what stays here is the smoke check,
  // now going through the real topmost element at each point.
  // ============================================================
  describe("Phase 4 — Painel: header / body / borda", () => {
    /**
     * Points computed from the LIVE rects, as functions, so every Cypress
     * retry re-measures. Freezing the coordinates first is what made the
     * header case flaky: the viewport is still settling right after
     * `waitForCanvas`, so a point read one frame early keeps being re-checked
     * where the panel no longer is.
     */
    const headerPoint = (doc: Document): [number, number] => {
      const hr = (
        doc.querySelector('[data-id="panel_big"] .panel-header') as HTMLElement
      ).getBoundingClientRect();
      return [hr.left + hr.width * 0.5, hr.top + hr.height * 0.5];
    };
    const borderPoint = (doc: Document): [number, number] => {
      const r = (doc.querySelector('[data-id="panel_big"]') as HTMLElement).getBoundingClientRect();
      return [r.left + 3, r.top + r.height * 0.7];
    };
    const bodyPoint = (doc: Document): [number, number] => {
      const panel = doc.querySelector('[data-id="panel_big"]') as HTMLElement;
      const r = panel.getBoundingClientRect();
      const hr = (panel.querySelector(".panel-header") as HTMLElement).getBoundingClientRect();
      const childBottom = Math.max(
        ...["child_1", "child_2"].map((id) => {
          const el = doc.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
          return el ? el.getBoundingClientRect().bottom : hr.bottom;
        }),
      );
      return [r.left + r.width * 0.5, Math.max(hr.bottom, childBottom) + 24];
    };

    it("clique no cabeçalho seleciona o painel", () => {
      cy.getNode("panel_big").find(".panel-header").should("exist");
      cy.assertHitRegion(headerPoint, "panel-header");
      cy.clickAtPoint(headerPoint);
      cy.getNode("panel_big").should("have.class", "selected");
    });

    it("clique na borda seleciona o painel", () => {
      cy.assertHitRegion(borderPoint, "panel-border");
      cy.clickAtPoint(borderPoint);
      cy.getNode("panel_big").should("have.class", "selected");
    });

    it("clique no corpo do painel NÃO seleciona o painel (decisão #1)", () => {
      // Select something else first, so "not selected" is not vacuous.
      //
      // `child_1` and not `standalone_1`: `testIsolation` is off for this
      // project, and the drag cases above leave the standalone nodes wherever
      // they were dropped — a non-forced click on one of them intermittently
      // lands on whatever it was dragged under. `child_1` is only ever
      // clicked, never moved.
      cy.document({ log: false }).then((doc) => {
        const child = doc.querySelector('[data-id="child_1"]') as HTMLElement;
        const r = child.getBoundingClientRect();
        cy.clickAt(r.left + r.width / 2, r.top + r.height / 2);
      });
      cy.getNode("child_1").should("have.class", "selected");
      // The point must genuinely belong to the body — this is the assertion
      // `force: true` used to skip.
      cy.assertHitRegion(bodyPoint, "panel-body");
      cy.clickAtPoint(bodyPoint);
      cy.getNode("panel_big").should("not.have.class", "selected");
      // And it clears, like any background click.
      cy.get(".react-flow__node.selected").should("not.exist");
    });

    it("arraste no cabeçalho move o painel (decisão #2 + freeze fix)", () => {
      cy.clickAtPoint(headerPoint);
      cy.getNode("panel_big").should("have.class", "selected");
      cy.getNode("panel_big")
        .invoke("attr", "style")
        .then((before) => {
          cy.document({ log: false }).then((doc) => {
            const [hx, hy] = headerPoint(doc);
            cy.dragFromPoint(hx, hy, hx + 120, hy);
          });
          cy.getNode("panel_big")
            .invoke("attr", "style")
            .should((after) => {
              // Compare only the translate: `z-index` and `visibility` change
              // with selection and culling, so comparing the whole style makes
              // the assertion react to things that are not the drag.
              expect(renderedTranslate(after)).to.not.deep.equal(renderedTranslate(before));
            });
        });
    });
  });

  // ============================================================
  // PHASE 4 — DECISÃO #9 (rect do marquee não bloqueia clique no pane)
  // ============================================================
  describe("Phase 4 — Rect do marquee", () => {
    it("clique em área vazia dentro do bbox de Cmd+A limpa a seleção", () => {
      // Select two standalones with Cmd+A style.
      cy.getNode("standalone_1").click({ force: true });
      cy.getNode("standalone_2").click({ metaKey: true, force: true });
      // Click in empty pane area to verify the pane clears selection.
      // We intentionally do not attempt to click inside the
      // `.react-flow__nodesselection-rect` bounding box in headless: RF
      // only mounts that rect while a marquee is in progress
      // (`nodesSelectionActive=true`), which is hard to assert against
      // from outside React Flow's internal store. The rule (decision
      // #9) is verified by manual Chrome check — see the manual script.
      cy.get(".react-flow__pane").click(500, 200, { force: true });
      cy.get(".react-flow__node.selected", { timeout: 3000 }).should("not.exist");
    });
  });
});
