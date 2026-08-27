/**
 * Decisão #7 do épico de seleção — requisito nominal do dono do produto:
 *
 *   "Só deveria abrir opções do botão direito quando soltar o botão direito.
 *    Se clicar e segurar, o usuário quer arrastar."
 *
 * Combinada com a decisão #8 (arrastar com o botão direito faz pan) e com o
 * mesmo limiar da decisão #4 (`DRAG_THRESHOLD_PX = 4`, em coordenada bruta do
 * ponteiro, antes de qualquer quantização do `snapGrid`).
 *
 * ## Por que o teste dispara `contextmenu` explicitamente
 *
 * O bug que esta suíte trava é de PLATAFORMA, e o Cypress roda num host só:
 *
 *  - macOS dispara `contextmenu` no **mousedown**;
 *  - Windows/Linux disparam depois do **mouseup**.
 *
 * Um teste que só dispare `mousedown`/`mouseup` nunca vê o caminho nativo e
 * certifica um requisito que não funciona. Por isso cada gesto é executado nas
 * DUAS ordenações, com o `contextmenu` posicionado explicitamente. É sintético
 * — mas é exatamente o evento que o browser real entrega, na posição em que
 * cada plataforma o entrega, e é o que faz um host Linux reprovar o bug do mac.
 *
 * ## O que cada caso prova
 *
 * | gesto                              | esperado                              |
 * |------------------------------------|---------------------------------------|
 * | pressiona, solta sem mover         | menu abre — e só depois do `mouseup`  |
 * | pressiona, move 2 px, solta        | menu abre (tremor não custa o menu)   |
 * | pressiona, move 50 px, solta       | menu NÃO abre — o gesto era arrasto   |
 *
 * O caso de 2 px não passa pelo `snapGrid`: pan e abertura de menu leem
 * `clientX/clientY` crus. O `snapGrid=[15,15]` só afeta `change.position` de
 * nós arrastados, que este arquivo nunca exercita.
 */

const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";
const DIAGRAM_ID = "diag_rightbutton_test";

/** Limiar da decisão #4 — mantido em sincronia com `selection/dragThreshold.ts`. */
const DRAG_THRESHOLD_PX = 4;

function buildPayload(): string {
  const now = new Date().toISOString();
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
    standalone_1: {
      id: "standalone_1",
      name: "Standalone 1",
      description: "Nó solto",
      parentId: null,
      type: "system",
    },
  };

  const nodeLayouts = {
    panel_big: { elementId: "panel_big", x: 300, y: 200, width: 500, height: 400 },
    standalone_1: { elementId: "standalone_1", x: 900, y: 700 },
  };

  return JSON.stringify({
    state: {
      diagrams: {
        [DIAGRAM_ID]: {
          id: DIAGRAM_ID,
          name: "Right Button Test",
          domain: "",
          level: "context",
          description: "Decisão #7",
          snapshot: { components, connections: {}, flows: {}, iconLibrary: {} },
          nodeLayouts,
          edgeLayouts: [],
          viewport: { x: 0, y: 0, zoom: 0.8 },
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

/** Onde o `contextmenu` nativo cai, por plataforma. */
type Ordering = "no-mousedown" | "apos-mouseup";

const ORDERINGS: { id: Ordering; label: string }[] = [
  { id: "no-mousedown", label: "macOS (contextmenu no mousedown)" },
  { id: "apos-mouseup", label: "Windows/Linux (contextmenu apos mouseup)" },
];

/**
 * Qual menu está aberto. Os dois popovers do canvas compartilham
 * `div.fixed.z-50`; o `NodeContextMenu` carrega `min-w-[220px]` na className e
 * o `QuickInsertPopover` é o único que tem um `<input>` de busca.
 */
function menuKind(win: Window): string {
  const kinds: string[] = [];
  win.document.querySelectorAll("div.fixed.z-50").forEach((el) => {
    const cls = el.className.toString();
    if (cls.includes("220px")) kinds.push("node-menu");
    else if (el.querySelector("input")) kinds.push("quick-insert");
  });
  return kinds.join(",");
}

function viewportTransform(win: Window): string {
  const el = win.document.querySelector(".react-flow__viewport") as HTMLElement | null;
  return el?.style.transform ?? "";
}

function mouse(win: Window, type: string, x: number, y: number, button: number, buttons: number) {
  return new win.MouseEvent(type, {
    clientX: x,
    clientY: y,
    button,
    buttons,
    bubbles: true,
    cancelable: true,
    view: win as unknown as Window,
  });
}

interface GestureProbe {
  /** Menu aberto no instante em que o botão ainda está PRESSIONADO. */
  atPress: string;
  /** Menu aberto depois de soltar. */
  afterUp: string;
  panned: boolean;
}

/**
 * Executa um gesto completo de botão direito sobre um elemento.
 *
 * Os eventos vão para alvos diferentes de propósito, porque os dois
 * consumidores escutam em lugares diferentes:
 *  - `mousedown`/`mouseup` no próprio elemento, para subir até o listener de
 *    captura do funil na `window`;
 *  - `mousemove` na `window`, que é onde o d3-zoom do React Flow escuta o
 *    resto do gesto depois que ele começa.
 */
function rightGesture(
  elementSelector: string,
  point: (rect: DOMRect) => { x: number; y: number },
  dx: number,
  ordering: Ordering,
): Cypress.Chainable<GestureProbe> {
  const probe: GestureProbe = { atPress: "", afterUp: "", panned: false };
  let before = "";

  cy.get(elementSelector).then(($el) => {
    const el = $el[0];
    const { x, y } = point(el.getBoundingClientRect());

    cy.window().then((win) => {
      before = viewportTransform(win);
      el.dispatchEvent(mouse(win, "mousedown", x, y, 2, 2));
      if (ordering === "no-mousedown") {
        el.dispatchEvent(mouse(win, "contextmenu", x, y, 2, 2));
      }
    });

    // Deixa o React aplicar qualquer setState disparado pelo press antes de
    // afirmar que nada abriu. Sem esta espera a asserção negativa passaria
    // mesmo com o bug presente — o menu simplesmente ainda não teria pintado.
    cy.wait(200);

    cy.window().then((win) => {
      probe.atPress = menuKind(win);

      for (let i = 1; i <= 6; i += 1) {
        win.dispatchEvent(mouse(win, "mousemove", x + (dx * i) / 6, y, 2, 2));
      }
      el.dispatchEvent(mouse(win, "mouseup", x + dx, y, 2, 0));
      if (ordering === "apos-mouseup") {
        const endEl = win.document.elementFromPoint(x + dx, y) ?? el;
        endEl.dispatchEvent(mouse(win, "contextmenu", x + dx, y, 2, 0));
      }
    });

    cy.wait(200);

    cy.window().then((win) => {
      probe.afterUp = menuKind(win);
      probe.panned = viewportTransform(win) !== before;
    });
  });

  return cy.then(() => probe);
}

/** Fecha qualquer popover e limpa a seleção entre gestos. */
function resetCanvas() {
  cy.get("body").type("{esc}");
  cy.window().then((win) => {
    const pane = win.document.querySelector(".react-flow__pane") as HTMLElement;
    pane.dispatchEvent(mouse(win, "mousedown", 5, 5, 0, 1));
    pane.dispatchEvent(mouse(win, "mouseup", 5, 5, 0, 0));
  });
  cy.wait(150);
  cy.window().should((win) => {
    expect(menuKind(win), "nenhum popover aberto antes do gesto").to.equal("");
  });
}

/**
 * Os quatro alvos do requisito, mais o interior do painel.
 *
 * `.panel-body` merece uma nota: no layout atual ele renderiza com altura 0 e
 * o `.panel-border` (`absolute inset-0`) cobre todo o interior do painel, de
 * modo que `elementFromPoint` no meio do painel devolve `.panel-border`, nunca
 * `.panel-body`. O gesto abaixo despacha direto no elemento `.panel-body` para
 * exercitar o ramo `panel-body` do funil e o `stopImmediatePropagation` que ele
 * faz no `mousedown`; `interior do painel` cobre o que o usuário de fato
 * acerta com o cursor.
 */
const TARGETS: {
  nome: string;
  selector: string;
  point: (rect: DOMRect) => { x: number; y: number };
  menuEsperado: string;
  /**
   * Decisão #8 — arrastar com o botão direito faz pan, **de qualquer lugar do
   * canvas**. Os oito casos de nó/painel viveram como `it.skip` enquanto a
   * regra era "pan por botão direito é gesto de pane"; o dono do produto
   * revogou essa regra e eles são agora o critério de aceite.
   *
   * Quem move o viewport depende de onde o gesto começa, e o teste é cego a
   * isso de propósito — ele afirma o efeito, não o mecanismo:
   *  - fora de `.nopan` → o d3-zoom do React Flow, via `panOnDrag=[1, 2]`;
   *  - dentro de `.nopan` (todo `.react-flow__node`) → o funil de ponteiro,
   *    que translada o viewport pelo delta do ponteiro porque o filtro do d3
   *    recusa o gesto ali.
   */
  panoramizaNoArrasto: boolean;
  /**
   * O limiar de 4 px governa o PAN neste alvo?
   *
   * Só onde o funil é dono do pan. Sobre a pane quem panoramiza é o d3-zoom,
   * que não tem limiar nenhum: ele translada o viewport pelo delta bruto do
   * ponteiro desde o primeiro `mousemove`, então 2 px movem 2 px. Medido, não
   * suposto — o caso de 2 px sobre a pane reprova se marcado como `true`.
   *
   * **Isso é anterior a esta fatia e não é o requisito.** O que o dono do
   * produto pediu, e o que vale nos cinco alvos, é o MENU: abaixo do limiar o
   * menu abre, acima não abre. Alinhar o d3 ao limiar exigiria interceptar o
   * pan da pane também, que é justamente o segundo caminho de pan que esta
   * implementação existe para evitar.
   */
  limiarGovernaOPan: boolean;
}[] = [
  {
    nome: "no",
    selector: '[data-id="standalone_1"]',
    point: (r) => ({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }),
    menuEsperado: "node-menu",
    panoramizaNoArrasto: true,
    limiarGovernaOPan: true,
  },
  {
    nome: "cabecalho de painel",
    selector: '[data-id="panel_big"] .panel-header',
    point: (r) => ({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }),
    menuEsperado: "node-menu",
    panoramizaNoArrasto: true,
    limiarGovernaOPan: true,
  },
  {
    nome: "corpo de painel",
    selector: '[data-id="panel_big"] .panel-body',
    point: (r) => ({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + 1) }),
    menuEsperado: "node-menu",
    panoramizaNoArrasto: true,
    limiarGovernaOPan: true,
  },
  {
    nome: "interior de painel",
    selector: '[data-id="panel_big"] .panel-border',
    point: (r) => ({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }),
    menuEsperado: "node-menu",
    panoramizaNoArrasto: true,
    limiarGovernaOPan: true,
  },
  {
    nome: "fundo do canvas",
    selector: ".react-flow__pane",
    // Canto superior direito da pane: longe do painel, dos nós soltos e do minimapa.
    point: (r) => ({ x: Math.round(r.right - 260), y: Math.round(r.top + 80) }),
    menuEsperado: "quick-insert",
    panoramizaNoArrasto: true,
    limiarGovernaOPan: false,
  },
];

describe("Decisão #7 — menu do botão direito abre no soltar, não no apertar", () => {
  beforeEach(() => {
    cy.visit(`/model/${DIAGRAM_ID}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, buildPayload());
      },
    });
    cy.waitForCanvas(2);
    resetCanvas();
  });

  TARGETS.forEach((target) => {
    describe(`alvo: ${target.nome}`, () => {
      ORDERINGS.forEach((ordering) => {
        it(`press + solta sem mover → menu abre, e só no soltar [${ordering.label}]`, () => {
          rightGesture(target.selector, target.point, 0, ordering.id).then((probe) => {
            expect(
              probe.atPress,
              `[${target.nome}] menu NAO pode estar aberto com o botao ainda pressionado`,
            ).to.equal("");
            expect(probe.afterUp, `[${target.nome}] menu deve abrir ao soltar`).to.equal(
              target.menuEsperado,
            );
          });
        });

        it(`press + move 2 px + solta → menu abre (tremor não custa o menu) [${ordering.label}]`, () => {
          rightGesture(target.selector, target.point, 2, ordering.id).then((probe) => {
            expect(
              probe.atPress,
              `[${target.nome}] menu NAO pode estar aberto com o botao ainda pressionado`,
            ).to.equal("");
            expect(
              probe.afterUp,
              `[${target.nome}] 2 px esta abaixo do limiar de ${DRAG_THRESHOLD_PX} px — menu deve abrir`,
            ).to.equal(target.menuEsperado);
          });
        });

        it(`press + move 50 px + solta → menu NÃO abre [${ordering.label}]`, () => {
          rightGesture(target.selector, target.point, 50, ordering.id).then((probe) => {
            expect(
              probe.atPress,
              `[${target.nome}] menu NAO pode estar aberto com o botao ainda pressionado`,
            ).to.equal("");
            expect(
              probe.afterUp,
              `[${target.nome}] 50 px esta acima do limiar de ${DRAG_THRESHOLD_PX} px — o gesto e um arrasto, o menu NAO pode abrir`,
            ).to.equal("");
          });
        });

        // Decisão #8 — vale para os cinco alvos. Comparar só o `transform` do
        // viewport, e não o `style` inteiro, é o que mantém esta asserção
        // falseável: `z-index` e `visibility` mudam por seleção e culling.
        it(`decisão #8 — arrasto de 50 px com botão direito panoramiza [${ordering.label}]`, () => {
          rightGesture(target.selector, target.point, 50, ordering.id).then((probe) => {
            expect(
              probe.panned,
              `[${target.nome}] o arrasto de 50 px com o botao direito deve panoramizar`,
            ).to.be.true;
          });
        });

        // O outro lado do limiar, onde ele governa. Sem este caso,
        // "panoramiza" passaria com um pan disparado já no press — que é
        // exatamente o que a decisão #7 proíbe — e a mutação do limiar não
        // teria nada para derrubar.
        //
        // Sobre a pane a asserção é invertida de propósito: quem panoramiza
        // ali é o d3-zoom, que não conhece limiar. Travar o comportamento nos
        // dois sentidos é o que impede a assimetria de virar surpresa depois.
        it(`decisão #8 — 2 px com botão direito ${target.limiarGovernaOPan ? "NÃO panoramiza" : "panoramiza (d3, sem limiar)"} [${ordering.label}]`, () => {
          rightGesture(target.selector, target.point, 2, ordering.id).then((probe) => {
            if (target.limiarGovernaOPan) {
              expect(
                probe.panned,
                `[${target.nome}] 2 px esta abaixo do limiar de ${DRAG_THRESHOLD_PX} px — o viewport NAO pode se mover`,
              ).to.be.false;
            } else {
              expect(
                probe.panned,
                `[${target.nome}] o pan da pane e do d3-zoom, que nao tem limiar — 2 px movem 2 px`,
              ).to.be.true;
            }
          });
        });
      });
    });
  });
});
