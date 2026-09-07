import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import JsonTree from "./JsonTree";
import FlowVariablesPanel from "./FlowVariablesPanel";
import type { ContextChange, RunningContext } from "./readingVariables";

/**
 * The object as the reader meets it.
 *
 * Two claims are worth the most here: the contract's two halves are on screen
 * at the same time, and a script with nothing to show has no panel and no
 * divider — the second is what keeps a simple reading simple.
 */

const EMPTY: RunningContext = {
  groups: [],
  byKey: new Map(),
  unsetReads: [],
  reads: [],
  size: 0,
};

function context(partial: Partial<RunningContext>): RunningContext {
  return { ...EMPTY, ...partial };
}

const NO_CHANGE: ContextChange = { introduced: [], replaced: [], gone: [], empty: true };

const numberOf = (stepId: string) => ({ s1: "1", s3: "4" })[stepId] ?? "?";
const frameName = () => "Pagamentos";

function renderPanel(props: Partial<Parameters<typeof FlowVariablesPanel>[0]> = {}) {
  return render(
    <FlowVariablesPanel
      sends={null}
      expected={null}
      context={EMPTY}
      change={NO_CHANGE}
      contract={null}
      numberOf={numberOf}
      frameName={frameName}
      {...props}
    />,
  );
}

describe("an object reads as an object", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("colours each JSON type apart", () => {
    render(<JsonTree value={{ nome: "ana", idade: 3, ativo: true }} />);

    expect(screen.getByText('"ana"').className).toContain("text-json-string");
    expect(screen.getByText("3").className).toContain("text-json-number");
    expect(screen.getByText("true").className).toContain("text-json-boolean");
  });

  it("folds a nested object away and brings it back", () => {
    render(<JsonTree value={{ cartao: { bin: "515590" } }} openToDepth={1} />);

    expect(screen.queryByText('"515590"')).toBeNull();
    fireEvent.click(screen.getByTestId("json-toggle"));

    expect(screen.getByText('"515590"')).toBeTruthy();
  });

  it("says what a folded node holds, so folding loses nothing", () => {
    render(<JsonTree value={{ cartao: { bin: "1", last4: "2" } }} openToDepth={1} />);

    expect(screen.getByTestId("json-toggle").textContent).toContain("2 campos");
  });
});

describe("both halves of the contract are on screen at once", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("shows what goes out and what is expected back", () => {
    renderPanel({
      sends: { json: { cpf: "***" }, text: "{}", direction: "request" },
      expected: {
        payload: { json: { score: 0.12 }, text: "{}", direction: "response" },
        fromStepId: "s3",
        explicit: false,
        nothingComesBack: false,
      },
    });

    expect(screen.getByTestId("flow-variables-root-sends")).toBeTruthy();
    expect(screen.getByTestId("flow-variables-root-expects")).toBeTruthy();
    expect(screen.getByText('"***"')).toBeTruthy();
    expect(screen.getByText("0.12")).toBeTruthy();
  });

  it("attributes the preview to the step it was taken from", () => {
    renderPanel({
      sends: { json: {}, text: "{}", direction: "request" },
      expected: {
        payload: { json: { score: 0.12 }, text: "{}", direction: "response" },
        fromStepId: "s3",
        explicit: false,
        nothingComesBack: false,
      },
    });

    expect(screen.getByTestId("flow-variables-toggle-expects").textContent).toContain("passo 4");
  });

  it("says out loud that nothing comes back from a fire-and-forget call", () => {
    renderPanel({
      expected: { payload: null, fromStepId: null, explicit: false, nothingComesBack: true },
    });

    fireEvent.click(screen.getByTestId("flow-variables-toggle-expects"));

    expect(screen.getByTestId("flow-variables-nothing")).toBeTruthy();
  });

  it("names the root by which way the body is travelling", async () => {
    renderPanel({ sends: { json: {}, text: "{}", direction: "response" } });

    expect(screen.getByTestId("flow-variables-toggle-sends").textContent).toContain("Recebe");
  });

  it("keeps a payload that is prose as prose", () => {
    renderPanel({ sends: { json: null, text: "cartão tokenizado", direction: "request" } });

    expect(screen.getByTestId("flow-variables-text").textContent).toBe("cartão tokenizado");
  });
});

describe("the state root opens shut and the payload root open", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("shows both the body and the running object without being asked", () => {
    renderPanel({
      sends: { json: { a: 1 }, text: "{}", direction: "request" },
      context: context({
        size: 1,
        groups: [
          {
            frameId: null,
            entries: [{ key: "x", value: "guardado", fromStepId: "s1", frameId: null }],
          },
        ],
      }),
    });

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByTestId("flow-variables-entry").textContent).toContain("guardado");

    expect(screen.getByTestId("flow-variables-entry")).toBeTruthy();
  });
});

describe("a value says where it came from", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  const withState = {
    context: context({
      size: 1,
      reads: ["cliente_id"],
      groups: [
        {
          frameId: null,
          entries: [{ key: "cliente_id", value: "c_8f3a", fromStepId: "s1", frameId: null }],
        },
      ],
    }),
  };

  it("names the step that introduced it", () => {
    renderPanel(withState);

    expect(screen.getByTestId("flow-variables-origin").textContent).toContain("1");
  });

  it("moves the reading there when chosen", () => {
    const onGoToStep = vi.fn();
    renderPanel({ ...withState, onGoToStep });

    fireEvent.click(screen.getByTestId("flow-variables-origin"));

    expect(onGoToStep).toHaveBeenCalledWith("s1");
  });

  it("marks the keys the step consumes apart from the rest", () => {
    renderPanel(withState);

    expect(screen.getByTestId("flow-variables-entry").textContent).toContain("↗");
  });

  it("reports a key nothing sets", () => {
    renderPanel({ context: context({ unsetReads: ["cupom_id"], reads: ["cupom_id"] }) });

    expect(screen.getByTestId("flow-variables-unset").textContent).toContain("cupom_id");
  });
});

describe("nothing to show means no panel at all", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("renders neither the panel nor its divider", () => {
    const { container } = renderPanel();

    expect(screen.queryByTestId("flow-variables")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("appears as soon as one root has something", () => {
    renderPanel({ sends: { json: { a: 1 }, text: "{}", direction: "request" } });

    expect(screen.getByTestId("flow-variables")).toBeTruthy();
  });
});

/**
 * What the step in hand just changed.
 *
 * The running object was a flat list: a value the step being read had only now
 * introduced looked exactly like one set twelve steps earlier, and a call
 * ending took its locals away in silence — the group was simply absent on the
 * next step. The panel now leads with the difference.
 */
describe("what the step in hand did to the running object", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  const entry = (key: string, value: string, fromStepId = "s2") => ({
    key,
    value,
    fromStepId,
    frameId: null,
  });

  const ONE_VALUE = context({
    groups: [{ frameId: null, entries: [entry("score", "0.12")] }],
    size: 1,
  });

  const change = (partial: Partial<ContextChange>): ContextChange => ({
    ...NO_CHANGE,
    ...partial,
    empty: false,
  });

  it("opens the running object without being asked", () => {
    renderPanel({ context: ONE_VALUE });

    expect(screen.getByTestId("flow-variables-toggle-state").getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(screen.getByTestId("flow-variables-entry")).toBeTruthy();
  });

  it("puts the running object above the bodies, being the only root that accumulates", () => {
    renderPanel({
      context: ONE_VALUE,
      sends: { json: { a: 1 }, text: '{"a":1}', direction: "request" },
    });

    const roots = screen.getAllByTestId(/^flow-variables-root-/);
    expect(roots.map((root) => root.getAttribute("data-testid"))).toEqual([
      "flow-variables-root-state",
      "flow-variables-root-sends",
    ]);
  });

  it("marks a value this step introduced", () => {
    renderPanel({ context: ONE_VALUE, change: change({ introduced: [entry("score", "0.12")] }) });

    expect(screen.getByTestId("flow-variables-new")).toBeTruthy();
    expect(screen.getByTestId("flow-variables-delta-new").textContent).toContain("1 novo");
  });

  it("marks nothing on a value an earlier step set", () => {
    renderPanel({ context: ONE_VALUE });

    expect(screen.queryByTestId("flow-variables-new")).toBeNull();
    expect(screen.queryByTestId("flow-variables-delta")).toBeNull();
  });

  it("shows the value a step wrote over, which used to be irrecoverable", () => {
    renderPanel({
      context: ONE_VALUE,
      change: change({
        replaced: [{ entry: entry("score", "0.12"), previous: entry("score", "0.99", "s1") }],
      }),
    });

    expect(screen.getByTestId("flow-variables-previous").textContent).toBe("0.99");
    expect(screen.getByTestId("flow-variables-changed")).toBeTruthy();
    expect(screen.getByTestId("flow-variables-delta-changed").textContent).toContain("1 alterado");
  });

  it("names the call a value left with", () => {
    renderPanel({
      context: ONE_VALUE,
      change: change({ gone: [{ frameId: "f1", entries: [entry("url_id", "u_9f2")] }] }),
    });

    expect(screen.getByTestId("flow-variables-delta-gone").textContent).toContain(
      "1 saiu com Pagamentos",
    );
  });

  it("keeps what leaves legible on the step that ends the call", () => {
    renderPanel({
      context: ONE_VALUE,
      change: change({ gone: [{ frameId: "f1", entries: [entry("url_id", "u_9f2")] }] }),
    });

    const leaving = screen.getByTestId("flow-variables-leaving");
    expect(leaving.textContent).toContain("url_id");
    expect(leaving.textContent).toContain("Pagamentos");
  });

  it("shows a call that ended even when nothing of the reading survives it", () => {
    renderPanel({
      context: EMPTY,
      change: change({ gone: [{ frameId: "f1", entries: [entry("url_id", "u_9f2")] }] }),
    });

    expect(screen.getByTestId("flow-variables-leaving").textContent).toContain("url_id");
  });
});

/**
 * Following one value through a reading.
 *
 * The strip stays put while the reading walks, and its most useful state is the
 * one that used to be an absence: when the fold no longer holds the key, it says
 * so instead of dropping the row — which is the only screen where the rule about
 * a call taking its values with it explains itself.
 */
describe("a key the reader is following", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  const entry = (key: string, value: string) => ({
    key,
    value,
    fromStepId: "s2",
    frameId: null,
  });

  const HELD = context({
    groups: [
      {
        frameId: null,
        entries: [{ key: "slug", value: "artigo26", fromStepId: "s1", frameId: null }],
      },
    ],
    byKey: new Map([["slug", { key: "slug", value: "artigo26", fromStepId: "s1", frameId: null }]]),
    size: 1,
  });

  it("shows the value the running object holds for it", () => {
    renderPanel({ context: HELD, pinnedKeys: ["slug"] });

    const watch = screen.getByTestId("flow-variables-watch");
    expect(watch.textContent).toContain("slug");
    expect(watch.textContent).toContain("artigo26");
    expect(screen.queryByTestId("flow-variables-watch-gone")).toBeNull();
  });

  it("says it is out of scope rather than hiding it", () => {
    renderPanel({ context: HELD, pinnedKeys: ["url_id"] });

    expect(screen.getByTestId("flow-variables-watch").textContent).toContain("url_id");
    expect(screen.getByTestId("flow-variables-watch-gone").textContent).toContain("fora de escopo");
  });

  /**
   * The strip read the running object, where the fold has already dropped what
   * this step's return is taking — so on that one step it called a key out of
   * scope while the list below it still showed the value, dimmed, going.
   */
  it("shows a value the step's own return is taking, as the list does", () => {
    renderPanel({
      context: HELD,
      pinnedKeys: ["url_id"],
      change: {
        introduced: [],
        replaced: [],
        gone: [{ frameId: "f1", entries: [entry("url_id", "u_9f2")] }],
        empty: false,
      },
    });

    const going = screen.getByTestId("flow-variables-watch-leaving");
    expect(going.textContent).toContain("u_9f2");
    expect(going.textContent).toContain("sai com Pagamentos");
    expect(screen.queryByTestId("flow-variables-watch-gone")).toBeNull();
  });

  it("calls it out of scope only once the call has actually ended", () => {
    renderPanel({ context: HELD, pinnedKeys: ["url_id"], change: NO_CHANGE });

    expect(screen.getByTestId("flow-variables-watch-gone")).toBeTruthy();
    expect(screen.queryByTestId("flow-variables-watch-leaving")).toBeNull();
  });

  it("is pinned from the running object and unpinned from the strip", () => {
    const onTogglePin = vi.fn();
    renderPanel({ context: HELD, pinnedKeys: ["slug"], onTogglePin });

    fireEvent.click(screen.getByTestId("flow-variables-pin"));
    fireEvent.click(screen.getByTestId("flow-variables-unpin"));

    expect(onTogglePin.mock.calls).toEqual([["slug"], ["slug"]]);
  });

  it("has no strip at all when nothing is pinned", () => {
    renderPanel({ context: HELD });

    expect(screen.queryByTestId("flow-variables-watch")).toBeNull();
  });

  it("opens the life of a key, naming each step and jumping to it", () => {
    const onGoToStep = vi.fn();
    renderPanel({
      context: HELD,
      pinnedKeys: ["slug"],
      onGoToStep,
      lifeOf: () => [
        { kind: "set", stepId: "s1", value: "artigo26" },
        { kind: "read", stepId: "s3" },
        { kind: "gone", stepId: "s3", frameId: "f1" },
      ],
    });

    fireEvent.click(screen.getByTestId("flow-variables-watch-key"));

    const events = screen.getAllByTestId("flow-variables-life-event");
    expect(events.map((node) => node.textContent)).toEqual(["1⊕artigo26", "4↗", "4↩Pagamentos"]);

    fireEvent.click(events[1]!);
    expect(onGoToStep).toHaveBeenCalledWith("s3");
  });

  it("renders no events for a key with no life on the walked path", () => {
    renderPanel({ context: HELD, pinnedKeys: ["slug"], lifeOf: () => [] });
    fireEvent.click(screen.getByTestId("flow-variables-watch-key"));

    expect(screen.queryAllByTestId("flow-variables-life-event")).toEqual([]);
  });
});
