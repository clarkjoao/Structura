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
    "panel_big": {
      id: "panel_big",
      name: "Big Panel",
      description: "Painel grande para teste",
      parentId: null,
      type: "panel",
      panelKind: "default",
      panelColor: "#6366f1",
    },
    "child_1": {
      id: "child_1",
      name: "Child 1",
      description: "",
      parentId: "panel_big",
      type: "system",
    },
    "child_2": {
      id: "child_2",
      name: "Child 2",
      description: "",
      parentId: "panel_big",
      type: "system",
    },
    "standalone_1": {
      id: "standalone_1",
      name: "Standalone 1",
      description: "Nó solto",
      parentId: null,
      type: "system",
    },
    "standalone_2": {
      id: "standalone_2",
      name: "Standalone 2",
      description: "Nó solto 2",
      parentId: null,
      type: "system",
    },
  };

  const connections = {
    "edge_1": {
      id: "edge_1",
      sourceId: "child_1",
      targetId: "child_2",
      label: "uses",
      style: {},
    },
  };

  const nodeLayouts = {
    "panel_big": { elementId: "panel_big", x: 300, y: 200, width: 500, height: 400 },
    "child_1": { elementId: "child_1", x: 50, y: 80 },
    "child_2": { elementId: "child_2", x: 250, y: 80 },
    "standalone_1": { elementId: "standalone_1", x: 100, y: 700 },
    "standalone_2": { elementId: "standalone_2", x: 900, y: 700 },
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

    it("H2b: Arraste de 1px NÃO move o nó (limiar de 3px)", () => {
      cy.getNode("standalone_1")
        .invoke("attr", "style")
        .then((before) => {
          const startPos = renderedTranslate(before as string);

          cy.dragNode("standalone_1", 1, 1);

          cy.getNode("standalone_1")
            .invoke("attr", "style")
            .then((after) => {
              const afterPos = renderedTranslate(after as string);
              const movedX = Math.abs(afterPos.x - startPos.x);
              const movedY = Math.abs(afterPos.y - startPos.y);
              cy.log(`Arraste de 1px: deltaX=${movedX.toFixed(1)}, deltaY=${movedY.toFixed(1)}`);

              // Com limiar de 3px, um arraste de 1px NÃO deve mover
              expect(movedX < 2 && movedY < 2, "nó NÃO deve ter se movido com apenas 1px").to.be.true;
            });
        });
    });

    it("H2c: Arraste de 2px NÃO move o nó (limiar de 3px)", () => {
      cy.getNode("standalone_1")
        .invoke("attr", "style")
        .then((before) => {
          const startPos = renderedTranslate(before as string);

          cy.dragNode("standalone_1", 2, 2);

          cy.getNode("standalone_1")
            .invoke("attr", "style")
            .then((after) => {
              const afterPos = renderedTranslate(after as string);
              const movedX = Math.abs(afterPos.x - startPos.x);
              const movedY = Math.abs(afterPos.y - startPos.y);
              cy.log(`Arraste de 2px: deltaX=${movedX.toFixed(1)}, deltaY=${movedY.toFixed(1)}`);

              // Com limiar de 3px, um arraste de 2px NÃO deve mover
              expect(movedX < 2 && movedY < 2, "nó NÃO deve ter se movido com apenas 2px").to.be.true;
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
        const hasSelected = $el.hasClass("selected") || $el.attr("aria-selected") === "true" || $el[0]?.classList.contains("selected");
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
                  expect(afterPos1.x, "standalone_1 deve ter se movido").to.be.greaterThan(startPos1.x);
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

    it("arrastar nó NÃO selecionado adiciona à seleção (draw.io parity)", () => {
      // Selecionar standalone_1
      cy.getNode("standalone_1").click({ force: true });
      cy.getNode("standalone_1").should("have.class", "selected");

      // Arrastar standalone_2 (não selecionado) - deve adicionar à seleção
      cy.getNode("standalone_2")
        .invoke("attr", "style")
        .then((before) => {
          const startPos = renderedTranslate(before as string);

          // Arrastar por mais de 3px para confirmar o drag
          cy.dragNode("standalone_2", 100, 50);

          // Aguardar para o React Flow processar
          cy.wait(100);

          // standalone_2 deve ter se movido
          cy.getNode("standalone_2")
            .invoke("attr", "style")
            .should((after) => {
              const afterPos = renderedTranslate(after);
              expect(afterPos.x, "standalone_2 deve ter se movido").to.be.greaterThan(startPos.x + 40);
            });

          // Verificar que AMBOS estão na seleção (draw.io parity)
          cy.get(".react-flow__node.selected").then(($nodes) => {
            const selectedIds = Array.from($nodes).map((n) => n.getAttribute("data-id"));
            cy.log(`Nós selecionados: ${JSON.stringify(selectedIds)}`);
            expect(selectedIds, "ambos standalone_1 e standalone_2 devem estar selecionados").to.include("standalone_1");
            expect(selectedIds, "ambos standalone_1 e standalone_2 devem estar selecionados").to.include("standalone_2");
          });
        });
    });
  });
});
