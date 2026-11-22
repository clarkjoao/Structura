import { describe, expect, it } from "vitest";
import { kindContextFor } from "../context";
import { guidedHarness } from "./guided.harness";
import { guidedKind } from "./guided.kind";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";
import { isMermaid, parseMermaid } from "./guided.mermaid.parse";
import { serializeMermaidJourney, serializeMermaidSwimlane } from "./guided.mermaid.serialize";

type Harness = ReturnType<typeof guidedHarness>;

function add(h: Harness, text: string, selected: string[] = []) {
  const parsed = isMermaid(text) ? parseMermaid(text) : parseOutline(text);
  const built = buildOutline(h.diagram(), parsed, selected, kindContextFor(h.diagram()));
  if ("errors" in built) throw new Error(`errors: ${JSON.stringify(built.errors)}`);
  if ("refused" in built) throw new Error(`refused: ${JSON.stringify(built.refused)}`);
  h.apply(built.edit);
  return built;
}

const stepByName = (h: Harness, name: string) => {
  const found = [...h.reading().steps.values()].filter((s) => s.name === name);
  expect(found, `one step named ${name}`).toHaveLength(1);
  return found[0]!;
};
const laneOf = (h: Harness, name: string) =>
  h.reading().lanes.find((l) => l.id === h.reading().laneOf.get(stepByName(h, name).id))?.name;
const edges = (h: Harness) =>
  [...h.reading().outgoing.values()]
    .flat()
    .map(
      (c) => `${h.nameOf(c.sourceId)} -> ${h.nameOf(c.targetId)}${c.label ? ` [${c.label}]` : ""}`,
    )
    .sort();
const codes = (text: string) => parseMermaid(text).errors.map((e) => [e.line, e.code]);

const SWIMLANE_DOC = `swimlane-beta LR
  subgraph Customer
    request[Request service]
    receive[Receive update]
  end

  subgraph Support
    triage[Triage request]
    answer[Send answer]
  end

  subgraph Engineering
    investigate[Investigate issue]
    fix[Prepare fix]
  end

  request --> triage
  triage -->|Known issue| answer
  triage -->|Needs code change| investigate
  investigate --> fix --> answer
  answer --> receive`;

const JOURNEY_DOC = `journey
    title My working day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
      Do work: 1: Me, Cat
    section Go home
      Go downstairs: 5: Me
      Sit down: 5: Me`;

describe("isMermaid", () => {
  it("recognises the headers, fenced or with front matter, and nothing else", () => {
    expect(isMermaid(SWIMLANE_DOC)).toBe(true);
    expect(isMermaid("```mermaid\nflowchart TD\n  a --> b\n```")).toBe(true);
    expect(isMermaid("---\ntitle: x\n---\n%% hi\ngraph LR\n a-->b")).toBe(true);
    expect(isMermaid(JOURNEY_DOC)).toBe(true);
    expect(isMermaid("Cliente: Escolhe produto\nApp: Paga")).toBe(false);
    expect(isMermaid("sequenceDiagram\n A->>B: hi")).toBe(false);
  });
});

describe("Mermaid swimlane import", () => {
  it("builds the documentation example: lanes, a decision with labelled exits, convergence", () => {
    const h = guidedHarness();
    add(h, SWIMLANE_DOC, [h.startId]);
    expect(h.reading().lanes.map((l) => l.name)).toEqual([
      "User",
      "System",
      "Customer",
      "Support",
      "Engineering",
    ]);
    expect(laneOf(h, "Triage request")).toBe("Support");
    expect(laneOf(h, "Prepare fix")).toBe("Engineering");
    // Triage splits the path: it comes in as a decision, though Mermaid drew a box.
    expect(stepByName(h, "Triage request").flowShape).toBe("diamond");
    expect(edges(h)).toEqual(
      [
        "Start -> Request service",
        "Request service -> Triage request",
        "Triage request -> Send answer [Known issue]",
        "Triage request -> Investigate issue [Needs code change]",
        "Investigate issue -> Prepare fix",
        "Prepare fix -> Send answer",
        "Send answer -> Receive update",
      ].sort(),
    );
  });

  it("reads shapes, & groups, text labels, chains, nested subgraphs and ignores styling", () => {
    const h = guidedHarness();
    add(
      h,
      [
        "```mermaid",
        "---",
        "title: Pedido",
        "---",
        "flowchart LR",
        "  %% comentário",
        "  classDef hot fill:#f00",
        "  subgraph cli [Cliente]",
        "    a[Escolhe] --> d{Pagou?}",
        '    subgraph inner ["Detalhe"]',
        "      z[[Valida cartão]]",
        "    end",
        "  end",
        "  subgraph api [API]",
        "    db[(Base de pedidos)]",
        '    doc@{ shape: doc, label: "Nota fiscal" }',
        "  end",
        "  d -- sim --> db & doc",
        "  d -->|não| z --> a",
        "  class a hot",
        "  style d fill:#fff",
        "```",
      ].join("\n"),
      [h.startId],
    );
    expect(stepByName(h, "Pagou?").flowShape).toBe("diamond");
    expect(stepByName(h, "Valida cartão").flowShape).toBe("subroutine");
    expect(laneOf(h, "Valida cartão")).toBe("Cliente");
    expect(stepByName(h, "Base de pedidos").flowShape).toBe("cylinder");
    expect(stepByName(h, "Nota fiscal").flowShape).toBe("document");
    expect(laneOf(h, "Nota fiscal")).toBe("API");
    expect(edges(h)).toEqual(
      [
        "Start -> Escolhe",
        "Escolhe -> Pagou?",
        "Pagou? -> Base de pedidos [sim]",
        "Pagou? -> Nota fiscal [sim]",
        "Pagou? -> Valida cartão [não]",
        "Valida cartão -> Escolhe",
      ].sort(),
    );
  });

  it("never adds a second start, and keeps the entry's labels", () => {
    const h = guidedHarness();
    add(h, "flowchart LR\n  s((Início)) -->|novo| a[Cadastro]\n  a --> f(((Fim)))", [h.startId]);
    expect(h.reading().starts).toHaveLength(1);
    expect(edges(h)).toEqual(["Cadastro -> Fim", "Start -> Cadastro [novo]"]);
    expect(stepByName(h, "Fim").flowShape).toBe("end");
  });

  it("hangs several entries from the anchor and keeps a node in its first lane", () => {
    const h = guidedHarness();
    add(
      h,
      [
        "swimlane-beta",
        "  subgraph A",
        "    x[X]",
        "  end",
        "  subgraph B",
        "    x",
        "    y[Y]",
        "  end",
        "  x --> m[M]",
        "  y --> m",
      ].join("\n"),
      [h.startId],
    );
    expect(laneOf(h, "X")).toBe("A");
    expect(edges(h)).toEqual(["Start -> X", "Start -> Y", "X -> M", "Y -> M"].sort());
  });

  it("inserted before a step, every entry leaves the anchor and every open end reaches it", () => {
    const h = guidedHarness();
    add(h, "Cliente: Depois", [h.startId]);
    add(h, "flowchart LR\n  x[X]\n  y[Y]", [h.startId]);
    expect(edges(h)).toEqual(["Start -> X", "Start -> Y", "X -> Depois", "Y -> Depois"].sort());
  });

  it("resolves revisits by id, even when two nodes share a label", () => {
    const h = guidedHarness();
    add(
      h,
      "graph TD\n  a[Revisar] --> b{Ok?}\n  b -->|não| c[Revisar]\n  c --> a\n  b -->|sim| d[Fim do fluxo]",
      [h.startId],
    );
    const named = [...h.reading().steps.values()].filter((s) => s.name === "Revisar");
    expect(named).toHaveLength(2);
    expect(edges(h)).toContain("Revisar -> Revisar");
    expect(edges(h)).toContain("Ok? -> Fim do fluxo [sim]");
  });

  it("is one undo step", () => {
    const h = guidedHarness();
    const before = edges(h);
    add(h, SWIMLANE_DOC, [h.startId]);
    h.store.getState().undo();
    expect(edges(h)).toEqual(before);
    expect(h.reading().lanes).toHaveLength(2);
  });

  it("reports errors per line", () => {
    expect(codes("swimlane-beta\n  subgraph Sales\n    a[A]")).toEqual([
      [2, "mermaidUnclosedSubgraph"],
    ]);
    expect(codes("flowchart LR\n  a[A]\nend")).toEqual([[3, "mermaidStrayEnd"]]);
    expect(codes("flowchart LR\n  a[A] -->")).toEqual([[2, "mermaidUnreadable"]]);
    expect(codes("flowchart LR\n  classDef x fill:#fff")).toEqual([[1, "mermaidEmpty"]]);
  });
});

describe("Mermaid journey import", () => {
  it("builds the tasks in order, in the first actor's lane, and counts what it sets aside", () => {
    const parsed = parseMermaid(JOURNEY_DOC);
    expect(parsed.setAside).toEqual({ sections: 2, scores: 0 });
    const h = guidedHarness();
    add(h, JOURNEY_DOC, [h.startId]);
    expect(h.sequence()).toEqual([
      "Start",
      "Make tea",
      "Go upstairs",
      "Do work",
      "Go downstairs",
      "Sit down",
    ]);
    expect(laneOf(h, "Do work")).toBe("Me");
  });

  it("reports a task without a score and a score out of range", () => {
    expect(codes("journey\n  section A\n  Make tea\n  Sleep: 9: Me")).toEqual([
      [3, "mermaidTaskWithoutScore"],
      [4, "mermaidScoreOutOfRange"],
    ]);
  });
});

describe("Mermaid export", () => {
  const fixtures: Record<string, string> = {
    linear: "Cliente: Escolhe\nApp: Paga\nAPI: Confirma\n! Pronto",
    converging:
      "Cliente: Escolhe\n? Pagou\n  sim -> App: Emite\n  não -> Cliente: Tenta\nApp: Envia\n! Fim",
    retry: "Cliente: Preenche\n? Válido\n  sim -> App: Salva\n  não -> @Preenche\n! Fim",
  };

  for (const [name, outline] of Object.entries(fixtures)) {
    it(`round-trips a ${name} journey through Mermaid swimlane`, () => {
      const a = guidedHarness();
      add(a, outline, [a.startId]);
      const text = serializeMermaidSwimlane(a.diagram(), kindContextFor(a.diagram()));
      expect(text).toMatch(/^%% .*\nswimlane-beta LR\n/);
      const b = guidedHarness();
      add(b, text, [b.startId]);
      expect(b.reading().lanes.map((l) => l.name)).toEqual(a.reading().lanes.map((l) => l.name));
      expect(edges(b)).toEqual(edges(a));
      const kinds = (h: Harness) =>
        [...h.reading().steps.values()].map((s) => `${s.name}:${s.flowShape}`).sort();
      expect(kinds(b)).toEqual(kinds(a));
    });
  }

  it("writes the main path as a journey, with a note on what it left out", () => {
    const h = guidedHarness();
    add(h, fixtures.converging!, [h.startId]);
    const text = serializeMermaidJourney(h.diagram(), kindContextFor(h.diagram()));
    expect(text).toContain("journey\n  title Checkout\n  section Checkout\n");
    expect(text).toContain(
      // The main path takes each decision's first exit in reading order (the upper lane first).
      "    Escolhe: 3: Cliente\n    Pagou: 3: Cliente\n    Tenta: 3: Cliente\n    Envia: 3: App\n",
    );
    expect(text).not.toContain("Emite");
    expect(text).toMatch(/%% .*1.*1/);
    // It reads back as a journey.
    expect(parseMermaid(text).errors).toEqual([]);
  });

  it("is offered through the guided text capture's formats", () => {
    expect(guidedKind.textCapture!.formats!.map((f) => f.id)).toEqual([
      "outline",
      "mermaid-swimlane",
      "mermaid-journey",
    ]);
  });
});
