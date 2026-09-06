import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { FlowStep } from "@/features/diagram";
import { StepContextEditor, type ScopeEntry, type ScopeGroup } from "./StepContextEditor";
import {
  fromSetRows,
  newSetRow,
  parseReads,
  rowsFromPaste,
  setsFromPayload,
  toSetRows,
} from "./stepContext";

/**
 * Getting a context onto a step, against the state it is written into.
 *
 * The field, its three consumers and the whole running object once shipped with
 * no way for anyone to write one. Then the way in was a textarea of
 * `key: value` lines, parsed on every keystroke and formatted back — which
 * turned `score: 0.12` into a key `s` holding `core:0.12`. Rows have identities
 * now, so there is nothing to parse and nothing to reformat.
 */

function step(partial: Partial<FlowStep> = {}): FlowStep {
  return { id: "s1", type: "action", ...partial } as FlowStep;
}

/** Most of these care about the values, not which call holds them. */
function outer(entries: ScopeEntry[]): ScopeGroup[] {
  return entries.length > 0 ? [{ frameId: null, name: null, endsAtNumber: null, entries }] : [];
}

function renderEditor(partial: Partial<FlowStep> = {}, scope: ScopeGroup[] | ScopeEntry[] = []) {
  const onChange = vi.fn();
  const groups = scope.every((item) => "entries" in item)
    ? (scope as ScopeGroup[])
    : outer(scope as ScopeEntry[]);
  render(<StepContextEditor step={step(partial)} scope={groups} onChange={onChange} />);
  return onChange;
}

const keyInputs = () => screen.getAllByTestId("step-context-set-key");
const valueInputs = () => screen.getAllByTestId("step-context-set-value");
const addSet = () => fireEvent.click(screen.getByTestId("step-context-add-set"));
const lastCall = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls[onChange.mock.calls.length - 1]![0];

describe("a value is a row, not a line of text", () => {
  it("turns an object into one row per key, and back", () => {
    const rows = toSetRows({ score: "0.12", cliente_id: "c_8f3a" });

    expect(rows.map((row) => row.key)).toEqual(["score", "cliente_id"]);
    expect(fromSetRows(rows)).toEqual({ score: "0.12", cliente_id: "c_8f3a" });
  });

  it("gives every row an identity of its own, so renaming a key keeps its place", () => {
    const rows = toSetRows({ a: "1", b: "2" });

    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
  });

  it("holds a row whose key is still being typed without letting it reach the step", () => {
    expect(fromSetRows([newSetRow("", "0.12")])).toBeUndefined();
  });

  it("keeps a value that would once have been split on its colon", () => {
    expect(fromSetRows([newSetRow("url", "https://x.com/a")])).toEqual({
      url: "https://x.com/a",
    });
  });

  it("comes back as nothing when nothing was written", () => {
    expect(fromSetRows([])).toBeUndefined();
  });

  it("reads a comma-separated list of keys", () => {
    expect(parseReads("score, cliente_id")).toEqual(["score", "cliente_id"]);
  });
});

describe("the step's own body can fill in for typing", () => {
  it("takes the top-level keys of a JSON object", () => {
    expect(setsFromPayload('{"pedido_id":"p_1","total":42}')).toEqual({
      pedido_id: "p_1",
      total: "42",
    });
  });

  it("keeps a nested value as the shape it is", () => {
    expect(setsFromPayload('{"cliente":{"id":"c_1"}}')).toEqual({
      cliente: '{"id":"c_1"}',
    });
  });

  it("offers nothing for prose, an array, or a body that is not there", () => {
    expect(setsFromPayload("o cliente paga")).toBeUndefined();
    expect(setsFromPayload("[1,2]")).toBeUndefined();
    expect(setsFromPayload(undefined)).toBeUndefined();
  });
});

describe("the editor writes a context onto the step", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("writes a value once its key has one", () => {
    const onChange = renderEditor();
    addSet();

    fireEvent.change(keyInputs()[0]!, { target: { value: "score" } });
    fireEvent.change(valueInputs()[0]!, { target: { value: "0.12" } });

    expect(lastCall(onChange)).toEqual({ sets: { score: "0.12" } });
  });

  it("survives a key typed one character at a time", () => {
    const onChange = renderEditor();
    addSet();

    for (const text of ["s", "sc", "sco", "scor", "score"]) {
      fireEvent.change(keyInputs()[0]!, { target: { value: text } });
    }
    fireEvent.change(valueInputs()[0]!, { target: { value: "0.12" } });

    expect(keyInputs()[0]).toHaveValue("score");
    expect(lastCall(onChange)).toEqual({ sets: { score: "0.12" } });
  });

  it("holds a second row without disturbing the first", () => {
    const onChange = renderEditor({ context: { sets: { score: "0.12" } } });
    addSet();

    fireEvent.change(keyInputs()[1]!, { target: { value: "aprovado" } });
    fireEvent.change(valueInputs()[1]!, { target: { value: "sim" } });

    expect(lastCall(onChange)).toEqual({ sets: { score: "0.12", aprovado: "sim" } });
  });

  it("takes a row out again", () => {
    const onChange = renderEditor({ context: { sets: { score: "0.12", extra: "x" } } });

    fireEvent.click(screen.getAllByTestId("step-context-remove-set")[1]!);

    expect(lastCall(onChange)).toEqual({ sets: { score: "0.12" } });
  });

  it("drops the whole field once its last member is cleared", () => {
    const onChange = renderEditor({ context: { sets: { score: "0.12" } } });

    fireEvent.click(screen.getByTestId("step-context-remove-set"));

    expect(lastCall(onChange)).toBeUndefined();
  });

  it("fills the values from the step's own body in one gesture", () => {
    const onChange = renderEditor({ payload: '{"pedido_id":"p_1","total":42}' });

    fireEvent.click(screen.getByTestId("step-context-from-payload"));

    expect(lastCall(onChange)).toEqual({ sets: { pedido_id: "p_1", total: "42" } });
  });

  it("offers nothing to take when the body is prose", () => {
    renderEditor({ payload: "o cliente paga" });

    expect(screen.queryByTestId("step-context-from-payload")).toBeNull();
  });
});

describe("the state already set is what the keys are chosen from", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  const SCOPE: ScopeEntry[] = [
    { key: "pedido_id", value: "p_1", fromNumber: "1" },
    { key: "score", value: "0.12", fromNumber: "3" },
  ];

  it("shows what is set here, with where each value came from", () => {
    renderEditor({}, SCOPE);

    const shown = screen.getByTestId("step-context-scope").textContent ?? "";
    expect(shown).toContain("pedido_id");
    expect(shown).toContain("p_1");
    expect(shown).toContain("3");
  });

  it("says nothing at all where nothing has been set yet", () => {
    renderEditor();

    expect(screen.queryByTestId("step-context-scope")).toBeNull();
  });

  it("offers every key in scope as one the step can consume", () => {
    renderEditor({}, SCOPE);

    const chips = screen.getAllByTestId("step-context-read-chip").map((n) => n.textContent);
    expect(chips).toEqual(["pedido_id", "score"]);
  });

  it("writes the key the author picks", () => {
    const onChange = renderEditor({}, SCOPE);

    fireEvent.click(screen.getAllByTestId("step-context-read-chip")[1]!);

    expect(lastCall(onChange)).toEqual({ reads: ["score"] });
  });

  it("takes a picked key back off", () => {
    const onChange = renderEditor({ context: { reads: ["score"] } }, SCOPE);

    fireEvent.click(screen.getAllByTestId("step-context-read-chip")[1]!);

    expect(lastCall(onChange)).toBeUndefined();
  });

  it("marks the keys already picked", () => {
    renderEditor({ context: { reads: ["score"] } }, SCOPE);

    const chips = screen.getAllByTestId("step-context-read-chip");
    expect(chips[0]).toHaveAttribute("aria-pressed", "false");
    expect(chips[1]).toHaveAttribute("aria-pressed", "true");
  });

  it("still takes a key nothing sets, which the reading is what reports", () => {
    const onChange = renderEditor({}, SCOPE);

    const field = screen.getByTestId("step-context-read-new");
    fireEvent.change(field, { target: { value: "cupom" } });
    fireEvent.keyDown(field, { key: "Enter" });

    expect(lastCall(onChange)).toEqual({ reads: ["cupom"] });
  });

  it("says when a value replaces one already set, and where that one came from", () => {
    renderEditor({ context: { sets: { score: "0.9" } } }, SCOPE);

    expect(screen.getByTestId("step-context-shadows").textContent).toContain("3");
  });

  it("says nothing for a value no earlier step set", () => {
    renderEditor({ context: { sets: { aprovado: "sim" } } }, SCOPE);

    expect(screen.queryByTestId("step-context-shadows")).toBeNull();
  });

  it("shows a key it already reads even when nothing in scope sets it", () => {
    renderEditor({ context: { reads: ["cupom"] } }, SCOPE);

    const chips = screen.getAllByTestId("step-context-read-chip").map((n) => n.textContent);
    expect(chips).toEqual(["pedido_id", "score"]);
    // Still offered, and no longer indistinguishable from a key that resolves.
    expect(screen.getByTestId("step-context-read-unset").textContent).toBe("cupom");
  });
});

describe("what a call expects back", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("is asked for on a request that names a connection", () => {
    renderEditor({ connectionId: "c1", payloadDirection: "request" });

    expect(screen.getByTestId("step-context-expects")).toBeTruthy();
  });

  it("is not asked for on a response, which is itself the answer", () => {
    renderEditor({ connectionId: "c1", payloadDirection: "response" });

    expect(screen.queryByTestId("step-context-expects")).toBeNull();
  });

  it("is not asked for on a step that makes no call", () => {
    renderEditor({ componentId: "a" });

    expect(screen.queryByTestId("step-context-expects")).toBeNull();
  });

  it("reaches the step as written", () => {
    const onChange = renderEditor({ connectionId: "c1", payloadDirection: "request" });

    fireEvent.change(within(screen.getByTestId("step-context-expects")).getByRole("textbox"), {
      target: { value: '{"pago":true}' },
    });

    expect(lastCall(onChange)).toEqual({ expects: '{"pago":true}' });
  });
});

/**
 * A key nothing sets, said where it is written.
 *
 * The reading has always reported it — `lê X, que nenhum passo anterior define`
 * — but only on the way back through. In the panel the chip looked exactly like
 * a chip for a key something does set.
 */
describe("a key nothing in scope sets", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("is marked apart from the keys that resolve", () => {
    renderEditor({ context: { reads: ["ttl_horas"] } }, [
      { key: "slug", value: "artigo26", fromNumber: "1" },
    ]);

    expect(screen.getByTestId("step-context-read-unset").textContent).toBe("ttl_horas");
    expect(screen.getByTestId("step-context-read-chip").textContent).toBe("slug");
  });

  it("marks nothing when every key read is in scope", () => {
    renderEditor({ context: { reads: ["slug"] } }, [
      { key: "slug", value: "artigo26", fromNumber: "1" },
    ]);

    expect(screen.queryByTestId("step-context-read-unset")).toBeNull();
  });
});

/**
 * Writing values without reaching for the mouse.
 *
 * Every row used to need a trip to the `+`, and a row opened and abandoned sat
 * there looking like part of the step.
 */
describe("the values table under the keyboard", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("opens the next row and puts the cursor in its key", () => {
    renderEditor({ context: { sets: { slug: "artigo26" } } });
    fireEvent.keyDown(keyInputs()[0]!, { key: "Enter" });

    expect(keyInputs()).toHaveLength(2);
    expect(document.activeElement).toBe(keyInputs()[1]);
  });

  it("opens it from the value cell too", () => {
    renderEditor({ context: { sets: { slug: "artigo26" } } });
    fireEvent.keyDown(valueInputs()[0]!, { key: "Enter" });

    expect(keyInputs()).toHaveLength(2);
  });

  it("opens nothing from a row that is not the last", () => {
    renderEditor({ context: { sets: { slug: "a", plano: "b" } } });
    fireEvent.keyDown(valueInputs()[0]!, { key: "Enter" });

    expect(keyInputs()).toHaveLength(2);
  });

  it("opens nothing from a row whose key is still empty", () => {
    renderEditor();
    addSet();
    fireEvent.keyDown(keyInputs()[0]!, { key: "Enter" });

    expect(keyInputs()).toHaveLength(1);
  });

  it("drops a row abandoned with no key", () => {
    renderEditor({ context: { sets: { slug: "a" } } });
    addSet();
    expect(keyInputs()).toHaveLength(2);

    fireEvent.blur(keyInputs()[1]!, { relatedTarget: document.body });

    expect(keyInputs()).toHaveLength(1);
  });

  it("drops one that got a value but never a key", () => {
    renderEditor({ context: { sets: { slug: "a" } } });
    addSet();
    fireEvent.change(valueInputs()[1]!, { target: { value: "orfao" } });
    fireEvent.blur(valueInputs()[1]!, { relatedTarget: document.body });

    expect(keyInputs()).toHaveLength(1);
  });

  it("keeps a row while focus is still inside the table", () => {
    renderEditor({ context: { sets: { slug: "a" } } });
    addSet();
    fireEvent.blur(keyInputs()[1]!, { relatedTarget: keyInputs()[0]! });

    expect(keyInputs()).toHaveLength(2);
  });

  it("turns a pasted block into rows", () => {
    const onChange = renderEditor();
    addSet();
    fireEvent.paste(keyInputs()[0]!, {
      clipboardData: { getData: () => "slug: artigo26\nshort_url: https://url.sh/x" },
    });

    expect(lastCall(onChange)).toEqual({
      sets: { slug: "artigo26", short_url: "https://url.sh/x" },
    });
  });
});

describe("text pasted into a key cell", () => {
  it("splits on the first colon, so a URL survives", () => {
    const rows = rowsFromPaste("slug: artigo26\nurl: https://url.sh/x");

    expect(rows?.map((row) => [row.key, row.value])).toEqual([
      ["slug", "artigo26"],
      ["url", "https://url.sh/x"],
    ]);
  });

  it("reads an object as its top-level keys", () => {
    expect(
      rowsFromPaste('{ "a": 1, "b": { "c": 2 } }')?.map((row) => [row.key, row.value]),
    ).toEqual([
      ["a", "1"],
      ["b", '{"c":2}'],
    ]);
  });

  it("leaves a single line to fill the cell it was pasted into", () => {
    expect(rowsFromPaste("https://url.sh/x")).toBeNull();
    expect(rowsFromPaste("slug: artigo26")).toBeNull();
  });

  it("leaves text that is not shaped like values alone", () => {
    expect(rowsFromPaste("uma nota\nsobre o passo")).toBeNull();
    expect(rowsFromPaste("   ")).toBeNull();
  });
});
