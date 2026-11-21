import { describe, expect, it } from "vitest";
import { kindContextFor } from "../context";
import { guidedHarness } from "./guided.harness";
import { buildOutline } from "./guided.outline.build";
import { escapeOutlineText, parseOutline } from "./guided.outline.parse";
import { serializeGuidedOutline } from "./guided.outline.serialize";

type Harness = ReturnType<typeof guidedHarness>;

const codes = (text: string) => parseOutline(text).errors.map((e) => [e.line, e.code]);

/** Adds `text` the way the panel does; throws on errors or a refusal. */
function addOutline(h: Harness, text: string, selected: string[] = []) {
  const built = buildOutline(
    h.diagram(),
    parseOutline(text),
    selected,
    kindContextFor(h.diagram()),
  );
  if ("errors" in built) throw new Error(`errors: ${JSON.stringify(built.errors)}`);
  if ("refused" in built) throw new Error(`refused: ${JSON.stringify(built.refused)}`);
  const result = h.apply(built.edit);
  return { built, select: built.select ? result.idsByKey[built.select] : undefined };
}

function stepByName(h: Harness, name: string): string {
  const found = [...h.reading().steps.values()].filter((s) => s.name === name);
  expect(found, `one step named ${name}`).toHaveLength(1);
  return found[0]!.id;
}

const laneNameOf = (h: Harness, stepId: string) =>
  h.reading().lanes.find((l) => l.id === h.reading().laneOf.get(stepId))?.name;

/** "A -> B [label]" for every step-to-step connection, sorted. */
function edges(h: Harness): string[] {
  const r = h.reading();
  return [...r.outgoing.values()]
    .flat()
    .map(
      (c) => `${h.nameOf(c.sourceId)} -> ${h.nameOf(c.targetId)}${c.label ? ` [${c.label}]` : ""}`,
    )
    .sort();
}

describe("parseOutline", () => {
  it("reads steps, lanes, decisions, exits, ends and jumps", () => {
    const parsed = parseOutline(
      [
        "# a comment",
        "Cliente: Escolhe produto",
        "App: Gera cobrança",
        "",
        "Envia QR code   # inline comment",
        "? Pagou",
        "  sim -> API: Confirma",
        "  não -> @Escolhe produto",
        "! Concluído",
      ].join("\n"),
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.lanes).toEqual(["Cliente", "App", "API"]);
    expect(parsed.nodeCount).toBe(6);
    const [a, b, c, d, e] = parsed.items;
    expect(a).toMatchObject({ kind: "step", name: "Escolhe produto", lane: "Cliente" });
    expect(c).toMatchObject({ kind: "step", name: "Envia QR code", lane: "App" });
    expect(d).toMatchObject({ kind: "decision", name: "Pagou", lane: "App" });
    expect(b).toMatchObject({ lane: "App" });
    if (d?.kind !== "decision") throw new Error("decision");
    expect(d.exits.map((x) => x.label)).toEqual(["sim", "não"]);
    expect(d.exits[0]!.body[0]).toMatchObject({ kind: "step", name: "Confirma", lane: "API" });
    expect(d.exits[1]!.body[0]).toMatchObject({ kind: "jump", target: "Escolhe produto" });
    expect(e).toMatchObject({ kind: "end", name: "Concluído", lane: "API" });
  });

  it("accepts → for -> and escapes with a backslash", () => {
    const parsed = parseOutline("? Ok\n  sim → Status\\: pago\n  não → \\? Dúvida");
    expect(parsed.errors).toEqual([]);
    const decision = parsed.items[0]!;
    if (decision.kind !== "decision") throw new Error("decision");
    expect(decision.exits[0]!.body[0]).toMatchObject({ name: "Status: pago", lane: null });
    expect(decision.exits[1]!.body[0]).toMatchObject({ kind: "step", name: "? Dúvida" });
  });

  it("continues a branch on deeper lines, and nests a decision in an exit", () => {
    const parsed = parseOutline(
      ["? A", "  sim -> X", "    Y", "  não -> ? B", "    ok -> Z", "    nok -> ! Fim"].join("\n"),
    );
    expect(parsed.errors).toEqual([]);
    const a = parsed.items[0]!;
    if (a.kind !== "decision") throw new Error("decision");
    expect(a.exits[0]!.body.map((i) => (i.kind === "jump" ? i.target : i.name))).toEqual([
      "X",
      "Y",
    ]);
    const b = a.exits[1]!.body[0]!;
    if (b.kind !== "decision") throw new Error("decision");
    expect(b.exits.map((x) => x.label)).toEqual(["ok", "nok"]);
  });

  it("declares a lane on its own line", () => {
    const parsed = parseOutline("API:\nValida\nCliente:");
    expect(parsed.errors).toEqual([]);
    expect(parsed.lanes).toEqual(["API", "Cliente"]);
    expect(parsed.items[0]).toMatchObject({ name: "Valida", lane: "API" });
  });

  it("reports each structural error with its line", () => {
    expect(codes("A\n  sim -> B")).toEqual([[2, "indentUnderStep"]]);
    expect(codes("A\nsim -> B")).toEqual([[2, "exitOutsideDecision"]]);
    expect(codes("? Pagou\nB")).toEqual([[1, "decisionWithoutExits"]]);
    expect(codes("? Pagou\n  sim ->")).toEqual([[2, "exitWithoutTarget"]]);
    expect(codes("? Pagou\n  B")).toEqual([
      [1, "decisionWithoutExits"],
      [2, "exitExpected"],
    ]);
    expect(codes("A\n?\n  x -> B")).toEqual([[2, "emptyName"]]);
    expect(codes("! Fim\nB")).toEqual([[2, "unreachableLine"]]);
    expect(codes("A\n-> @A\nB")).toEqual([[3, "unreachableLine"]]);
  });

  it("escapes text so it reads back as itself", () => {
    for (const name of ["Status: pago", "? talvez", "a -> b", "Pedido #12 e # nota", "@x", "!"]) {
      const parsed = parseOutline(escapeOutlineText(name));
      expect(parsed.errors).toEqual([]);
      expect(parsed.items[0]).toMatchObject({ kind: "step", name });
    }
  });
});

describe("buildOutline", () => {
  it("adds a linear journey after the start, across lanes, in one undo step", () => {
    const h = guidedHarness();
    const [user, system] = h.reading().lanes.map((l) => l.name);
    const before = h.diagram().snapshot;
    const { select } = addOutline(
      h,
      `${user}: Escolhe produto\n${system}: Gera cobrança\nEnvia QR`,
    );
    expect(h.sequence().slice(1)).toEqual(["Escolhe produto", "Gera cobrança", "Envia QR"]);
    expect(laneNameOf(h, stepByName(h, "Gera cobrança"))).toBe(system);
    expect(laneNameOf(h, stepByName(h, "Envia QR"))).toBe(system);
    expect(select).toBe(stepByName(h, "Envia QR"));

    h.store.setState({ _lastUndoRedoTimestamp: 0 });
    h.store.getState().undo();
    expect(h.diagram().snapshot.components).toEqual(before.components);
    expect(h.diagram().snapshot.connections).toEqual(before.connections);
  });

  it("creates a lane that matches no lane after the existing ones, matching names loosely", () => {
    const h = guidedHarness();
    const lanes = h.reading().lanes.map((l) => l.name);
    addOutline(h, `API: Confirma\n${lanes[0]!.toUpperCase()}  : Vê o recibo`);
    expect(h.reading().lanes.map((l) => l.name)).toEqual([...lanes, "API"]);
    expect(laneNameOf(h, stepByName(h, "Vê o recibo"))).toBe(lanes[0]);
  });

  it("converges the open exits on the next line, labels exits, ends and jumps", () => {
    const h = guidedHarness();
    addOutline(
      h,
      [
        "Escolhe",
        "? Pagou",
        "  sim -> Confirma",
        "  não -> Tenta de novo",
        "  desistiu -> ! Cancelado",
        "Emite nota",
        "? Ok",
        "  sim -> ! Fim",
        "  não -> @Escolhe",
      ].join("\n"),
    );
    expect(edges(h)).toEqual(
      [
        `${h.nameOf(h.startId)} -> Escolhe`,
        "Escolhe -> Pagou",
        "Pagou -> Confirma [sim]",
        "Pagou -> Tenta de novo [não]",
        "Pagou -> Cancelado [desistiu]",
        "Confirma -> Emite nota",
        "Tenta de novo -> Emite nota",
        "Emite nota -> Ok",
        "Ok -> Fim [sim]",
        "Ok -> Escolhe [não]",
      ].sort(),
    );
    const cancel = h.reading().steps.get(stepByName(h, "Cancelado"))!;
    expect(cancel.flowShape).toBe("end");
    expect(h.reading().steps.get(stepByName(h, "Pagou"))!.flowShape).toBe("diamond");
  });

  it("jumps to an existing step, and reports unknown and ambiguous jumps by line", () => {
    const h = guidedHarness();
    addOutline(h, "A\nB");
    addOutline(h, "C\n-> @a", [stepByName(h, "B")]);
    expect(edges(h)).toContain("C -> A");

    const unknown = buildOutline(
      h.diagram(),
      parseOutline("X\n-> @Nada"),
      [],
      kindContextFor(h.diagram()),
    );
    expect(unknown).toEqual({
      errors: [{ line: 2, code: "unknownJump", values: { name: "Nada" } }],
    });

    addOutline(h, "A", [stepByName(h, "C")]);
    const ambiguous = buildOutline(
      h.diagram(),
      parseOutline("X\n-> @A"),
      [],
      kindContextFor(h.diagram()),
    );
    expect(ambiguous).toMatchObject({ errors: [{ line: 2, code: "ambiguousJump" }] });
  });

  it("inserts after a selected step like Tab: A → X → Y → B", () => {
    const h = guidedHarness();
    addOutline(h, "A\nB");
    addOutline(h, "X\nY", [stepByName(h, "A")]);
    expect(h.sequence().slice(1)).toEqual(["A", "X", "Y", "B"]);
  });

  it("adds a new exit to a selected decision, and refuses an end step", () => {
    const h = guidedHarness();
    addOutline(h, "? Ok\n  sim -> A\n! Fim");
    addOutline(h, "Outro", [stepByName(h, "Ok")]);
    expect(edges(h)).toContain("Ok -> Outro");
    const built = buildOutline(
      h.diagram(),
      parseOutline("X"),
      [stepByName(h, "Fim")],
      kindContextFor(h.diagram()),
    );
    expect(built).toEqual({ refused: { key: "diagramKinds.guided.refused.endHasNoNext" } });
  });

  it("with nothing selected, adds before the main path's end step", () => {
    const h = guidedHarness();
    addOutline(h, "A\n! Fim");
    addOutline(h, "B");
    expect(h.sequence().slice(1)).toEqual(["A", "B", "Fim"]);
  });

  it("refuses an insert that would close every path", () => {
    const h = guidedHarness();
    addOutline(h, "A\nB");
    const built = buildOutline(
      h.diagram(),
      parseOutline("! Fim"),
      [stepByName(h, "A")],
      kindContextFor(h.diagram()),
    );
    expect(built).toEqual({ refused: { key: "diagramKinds.guided.refused.outlineClosesPath" } });
  });

  it("lays the steps in their lane bands and derives the flow", () => {
    const h = guidedHarness();
    addOutline(h, "API: Valida\nResponde");
    const step = h.absolute(stepByName(h, "Responde"));
    const lane = h.absolute(h.reading().laneOf.get(stepByName(h, "Responde"))!);
    expect(step.y).toBeGreaterThanOrEqual(lane.y);
    expect(step.y + step.height).toBeLessThanOrEqual(lane.y + lane.height);
    expect(h.sequence()).toContain("Responde");
  });

  it("reports what it adds", () => {
    const h = guidedHarness();
    const built = buildOutline(
      h.diagram(),
      parseOutline("API: ? Ok\n  sim -> A\n  não -> B"),
      [],
      kindContextFor(h.diagram()),
    );
    expect(built).toMatchObject({ added: { lanes: 1, steps: 3, decisions: 1 } });
  });
});

describe("serializeGuidedOutline", () => {
  const fixtures: Record<string, string> = {
    linear: "Escolhe\nSistema: Gera cobrança\nEnvia\n! Fim",
    converging: [
      "Escolhe",
      "? Pagou",
      "  sim -> API: Confirma",
      "  não -> Usuário: Tenta",
      "Sistema: Emite nota",
      "! Fim",
    ].join("\n"),
    retry: ["Escolhe", "? Pagou", "  sim -> ! Fim", "  não -> Avisa", "    -> @Escolhe"].join("\n"),
  };

  it.each(Object.keys(fixtures))("round trips the %s journey", (name) => {
    const source = guidedHarness();
    addOutline(source, fixtures[name]!);
    const text = serializeGuidedOutline(source.diagram(), kindContextFor(source.diagram()));
    expect(parseOutline(text).errors).toEqual([]);

    const copy = guidedHarness();
    addOutline(copy, text);
    expect(edges(copy)).toEqual(edges(source));
    const shapes = (h: Harness) =>
      [...h.reading().steps.values()]
        .map((s) => `${s.name}:${s.flowShape}:${laneNameOf(h, s.id)}`)
        .sort();
    expect(shapes(copy)).toEqual(shapes(source));
    expect(copy.reading().lanes.map((l) => l.name)).toEqual(
      source.reading().lanes.map((l) => l.name),
    );
  });

  it("declares the lanes, writes exits indented and revisits as jumps", () => {
    const h = guidedHarness();
    addOutline(h, fixtures.retry!);
    const text = serializeGuidedOutline(h.diagram(), kindContextFor(h.diagram()));
    expect(text).toContain("? Pagou\n");
    expect(text).toContain("\n  sim -> ! Fim\n");
    expect(text).toContain("\n  não -> Avisa\n    -> @Escolhe\n");
    expect(
      text.startsWith(
        h
          .reading()
          .lanes.map((l) => `${l.name}:`)
          .join("\n"),
      ),
    ).toBe(true);
  });

  it("leaves out unreachable steps with a comment", () => {
    const h = guidedHarness();
    addOutline(h, "A");
    h.apply({
      add: [
        {
          key: "lost",
          type: "process-node",
          flowShape: "rectangle",
          name: "Solto",
          parent: h.laneIds[1]!,
          x: 0,
          y: 0,
        },
      ],
    });
    const text = serializeGuidedOutline(h.diagram(), kindContextFor(h.diagram()));
    expect(text).not.toContain("Solto");
    expect(text).toMatch(/^# .*1/m);
  });
});
