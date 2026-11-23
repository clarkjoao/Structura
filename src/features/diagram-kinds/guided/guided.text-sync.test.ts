import { describe, expect, it } from "vitest";
import { kindContextFor } from "../context";
import { registerBuiltInDiagramKinds } from "../bootstrap";
import { guidedHarness } from "./guided.harness";
import { alignLines } from "../textAlign";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";
import { reconcileOutline } from "./guided.outline.reconcile";
import { serializeGuidedOutlineWithIds, writeGuidedOutline } from "./guided.outline.serialize";
import { phaseStartOf } from "./guided.phases";
import { editForChanges } from "../kindEditMerge";

registerBuiltInDiagramKinds();

type Harness = ReturnType<typeof guidedHarness>;

function add(h: Harness, text: string) {
  const built = buildOutline(
    h.diagram(),
    parseOutline(text),
    [h.startId],
    kindContextFor(h.diagram()),
  );
  if (!("edit" in built)) throw new Error(JSON.stringify(built));
  h.apply(built.edit);
}

const idOf = (h: Harness, name: string) =>
  [...h.reading().steps.values()].find((s) => s.name === name)?.id;
const names = (h: Harness) => [...h.reading().steps.values()].map((s) => s.name).sort();
/** The journey's sequence from the start, by the first exit. */
function sequence(h: Harness): string[] {
  const r = h.reading();
  const out: string[] = [];
  let at = r.outgoing.get(h.startId)?.[0]?.targetId;
  const seen = new Set<string>();
  while (at && !seen.has(at)) {
    seen.add(at);
    out.push(r.steps.get(at)!.name);
    at = r.outgoing.get(at)?.[0]?.targetId;
  }
  return out;
}

/** Writes the journey, lets `change` edit the text, and applies the difference. */
function edit(h: Harness, change: (text: string) => string) {
  const ctx = kindContextFor(h.diagram());
  const base = writeGuidedOutline(h.diagram(), ctx);
  const result = reconcileOutline(h.diagram(), base, change(base.text), ctx);
  if ("errors" in result) throw new Error(JSON.stringify(result.errors));
  h.apply(result.edit);
  return result;
}

describe("step handles in the outline", () => {
  it("reads a trailing handle, after a score, also on exits; keeps an escaped brace", () => {
    const parsed = parseOutline(
      "Cliente: A {#s1}\n? Ok {#s2}\n  sim -> B {#s-3_x}\nC \\{#s4}\nD {#bad name}",
    );
    expect(parsed.errors).toEqual([]);
    const [a, ok, c, d] = parsed.items as Array<{
      name: string;
      handle?: string;
      experience?: number;
      exits: Array<{ body: Array<{ name: string; handle?: string }> }>;
    }>;
    expect([a!.name, a!.handle]).toEqual(["A", "s1"]);
    expect(ok!.handle).toBe("s2");
    expect(ok!.exits[0]!.body[0]).toMatchObject({ name: "B", handle: "s-3_x" });
    expect([c!.name, c!.handle]).toEqual(["C {#s4}", undefined]);
    expect([d!.name, d!.handle]).toEqual(["D {#bad name}", undefined]);
  });

  it("is ignored when an outline is added", () => {
    const h = guidedHarness();
    add(h, "Cliente: X {#s1}\nY {#s2}");
    expect(names(h)).toContain("X");
    expect(names(h).some((n) => n.includes("{#"))).toBe(false);
  });

  it("numbers handles in reading order and aligns line ids to lines", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\n? Ok\n  sim -> B\n  não -> ! Fim");
    const base = writeGuidedOutline(h.diagram(), kindContextFor(h.diagram()));
    const lines = base.text.split("\n");
    base.lineIds.forEach((id, i) => {
      if (id) expect(lines[i]).toContain(h.reading().steps.get(id)!.name);
    });
    expect(Object.keys(base.handles)).toEqual(["s1", "s2", "s3", "s4"]);
    expect(h.reading().steps.get(base.handles.s3!)!.name).toBe("B");
  });
});

describe("line alignment", () => {
  const ids = ["a", "b", "c"];
  const nodes = (n: number) => new Set(Array.from({ length: n }, (_, i) => i + 1));
  it("keeps kept lines and pairs a line edited in place", () => {
    const map = alignLines(["A", "B", "C"], ids, ["A", "Bee [2]", "C"], nodes(3));
    expect([...map.entries()]).toEqual([
      [1, "a"],
      [2, "b"],
      [3, "c"],
    ]);
  });
  it("leaves an inserted line new and drops a deleted one", () => {
    expect([...alignLines(["A", "B", "C"], ids, ["A", "X", "B", "C"], nodes(4)).entries()]).toEqual(
      [
        [1, "a"],
        [3, "b"],
        [4, "c"],
      ],
    );
    expect([...alignLines(["A", "B", "C"], ids, ["A", "C"], nodes(2)).entries()]).toEqual([
      [1, "a"],
      [2, "c"],
    ]);
  });
  it("keeps both lines of a swap", () => {
    const map = alignLines(["A", "B"], ["a", "b"], ["B", "A"], nodes(2));
    expect(new Set(map.values()).size).toBe(2);
  });
});

describe("applying a whole-journey text", () => {
  it("renames in place: the same element, one undo", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\nB\nC");
    const b = idOf(h, "B")!;
    const result = edit(h, (t) => t.replace("\nB\n", "\nBee\n"));
    expect(result.changes.map((c) => c.kind)).toEqual(["rename"]);
    expect(idOf(h, "Bee")).toBe(b);
    h.store.getState().undo();
    expect(idOf(h, "B")).toBe(b);
  });

  it("removes, adds and renames in one edit, undone at once", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\nB\nC");
    edit(h, (t) => t.replace("A\n", "Alpha\n").replace("\nB\n", "\n").replace("C\n", "C\nD\n"));
    expect(sequence(h)).toEqual(["Alpha", "C", "D"]);
    h.store.getState().undo();
    expect(sequence(h)).toEqual(["A", "B", "C"]);
  });

  it("changes kind, lane, phase and exit labels", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\n? Ok\n  sim -> B\n  não -> ! Fim\nC");
    const result = edit(h, (t) =>
      t
        .replace("Cliente: A", "## Comprar\nCliente: A")
        .replace("sim -> B", "yes -> Sistema: B")
        .replace("não -> ! Fim", "não -> Cliente: ! Fim")
        .replace(/^(\s*)C$/m, "$1Cliente: ? C\n$1  -> @A"),
    );
    expect(result.changes.map((c) => c.kind).sort()).toEqual(
      ["kind", "lane", "phase", "relabel", "connect"].sort(),
    );
    const r = h.reading();
    expect(phaseStartOf(r.steps.get(idOf(h, "A")!)!)).toBe("Comprar");
    expect(r.lanes.find((l) => l.id === r.laneOf.get(idOf(h, "B")!))!.name).toBe("Sistema");
    expect(r.steps.get(idOf(h, "C")!)!.flowShape).toBe("diamond");
  });

  it("never touches what the text does not write", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\nB");
    // X: unreachable; A → X: a non-decision step's second exit.
    h.apply({
      add: [
        {
          key: "x",
          type: "process-node",
          flowShape: "rectangle",
          name: "X",
          parent: h.reading().laneOf.get(idOf(h, "A")!)!,
          x: 900,
          y: 160,
        },
      ],
      connect: [{ source: idOf(h, "A")!, target: "x" }],
    });
    const before = Object.keys(h.diagram().snapshot.connections).length;
    const result = edit(h, (t) => t.replace("B\n", "B\nC\n"));
    expect(result.changes.map((c) => c.kind)).toEqual(["add"]);
    expect(names(h)).toContain("X");
    expect(Object.keys(h.diagram().snapshot.connections).length).toBe(before + 1);
  });

  it("follows handles when a line moves", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\nB\nC");
    const ctx = kindContextFor(h.diagram());
    const text = serializeGuidedOutlineWithIds(h.diagram(), ctx);
    expect(text).toContain("A {#s1}");
    const base = writeGuidedOutline(h.diagram(), ctx);
    const lines = text.split("\n");
    const a = lines.findIndex((l) => l.includes("{#s1}"));
    const c = lines.findIndex((l) => l.includes("{#s3}"));
    [lines[a], lines[c]] = [lines[c]!, lines[a]!];
    const result = reconcileOutline(h.diagram(), base, lines.join("\n"), ctx);
    if ("errors" in result) throw new Error("errors");
    expect(result.changes.some((c) => c.kind === "add" || c.kind === "remove")).toBe(false);
    const cId = idOf(h, "C");
    h.apply(result.edit);
    expect(sequence(h)).toEqual(["C", "B", "A"]);
    expect(idOf(h, "C")).toBe(cId);
  });

  it("reports an unknown or repeated handle on its line", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\nB");
    const ctx = kindContextFor(h.diagram());
    const base = writeGuidedOutline(h.diagram(), ctx);
    const unknown = reconcileOutline(h.diagram(), base, "Cliente: A {#s99}\nB", ctx);
    expect("errors" in unknown && unknown.errors.map((e) => [e.line, e.code])).toEqual([
      [1, "unknownHandle"],
    ]);
    const twice = reconcileOutline(h.diagram(), base, "Cliente: A {#s1}\nB {#s1}", ctx);
    expect("errors" in twice && twice.errors.map((e) => e.code)).toEqual(["duplicateHandle"]);
  });

  it("leaves out changes to a step deleted since the text was written", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\nB\nC");
    const ctx = kindContextFor(h.diagram());
    const base = writeGuidedOutline(h.diagram(), ctx);
    h.apply({ remove: [idOf(h, "B")!] });
    const result = reconcileOutline(
      h.diagram(),
      base,
      base.text.replace("\nB\n", "\nBee\n").replace("A\n", "Alpha\n"),
      kindContextFor(h.diagram()),
    );
    if ("errors" in result) throw new Error("errors");
    expect(result.skipped).toBe(1);
    expect(result.changes.filter((c) => c.kind === "rename").map((c) => c.values.after)).toEqual([
      "Alpha",
    ]);
  });

  it("stays fast on a long journey", () => {
    const h = guidedHarness();
    add(h, ["Cliente: s0", ...Array.from({ length: 299 }, (_, i) => `s${i + 1}`)].join("\n"));
    const ctx = kindContextFor(h.diagram());
    const base = writeGuidedOutline(h.diagram(), ctx);
    let text = base.text;
    for (let i = 10; i < 300; i += 15) text = text.replace(`\ns${i}\n`, `\ns${i} renamed\n`);
    const t0 = performance.now();
    const result = reconcileOutline(h.diagram(), base, text, ctx);
    expect(performance.now() - t0).toBeLessThan(200);
    if ("errors" in result) throw new Error("errors");
    expect(result.changes.filter((c) => c.kind === "rename")).toHaveLength(20);
  });
});

describe("changes for review", () => {
  const reconcile = (h: Harness, change: (text: string) => string) => {
    const ctx = kindContextFor(h.diagram());
    const base = writeGuidedOutline(h.diagram(), ctx);
    const result = reconcileOutline(h.diagram(), base, change(base.text), ctx);
    if ("errors" in result) throw new Error(JSON.stringify(result.errors));
    return result;
  };
  const groupOf = (changes: { key: string; group?: string }[], key: string) =>
    changes.find((c) => c.key.startsWith(key))?.group;

  it("ties steps added together, and a removal to the connection that sews its neighbours", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\nB\nC");
    const result = reconcile(h, (t) => t.replace("\nB\n", "\n").replace("C\n", "C\nX\nY\n"));
    const { changes } = result;
    const x = changes.find((c) => c.kind === "add" && c.values.name === "X")!;
    const y = changes.find((c) => c.kind === "add" && c.values.name === "Y")!;
    expect(x.group).toBe(y.group);
    const remove = changes.find((c) => c.kind === "remove")!;
    const sew = changes.find((c) => c.kind === "connect")!;
    expect(sew.group).toBe(remove.group);
    expect(groupOf(changes, "add:")).not.toBe(remove.group);
  });

  it("applies only the changes taken, never leaving a dangling connection", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\nB\nC");
    const result = reconcile(h, (t) =>
      t.replace("A\n", "Alpha\n").replace("\nB\n", "\n").replace("C\n", "Cee\n"),
    );
    const taken = new Set(
      result.changes
        .filter((c) => c.group !== result.changes.find((r) => r.kind === "remove")!.group)
        .map((c) => c.key),
    );
    const before = Object.keys(h.diagram().snapshot.connections).length;
    h.apply(editForChanges(h.reading().components, result.changes, taken));
    expect(names(h)).toEqual(expect.arrayContaining(["Alpha", "B", "Cee"]));
    expect(Object.keys(h.diagram().snapshot.connections)).toHaveLength(before);
    expect(sequence(h)).toEqual(["Alpha", "B", "Cee"]);
  });

  it("carries a `# why:` reason and the phase a change falls in", () => {
    const h = guidedHarness();
    add(h, "## Descobrir\nCliente: A\n## Comprar\nB");
    const result = reconcile(
      h,
      (t) => t.replace(/^B$/m, "# why: clearer for the customer\nBuy it") + "# why: stray\n",
    );
    const rename = result.changes.find((c) => c.kind === "rename")!;
    expect(rename.reason).toBe("clearer for the customer");
    expect(rename.phase).toBe("Comprar");
    expect(result.changes.filter((c) => c.reason === "stray")).toHaveLength(0);
  });
});
