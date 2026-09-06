import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import JsonTree from "./JsonTree";
import FlowVariablesPanel from "./FlowVariablesPanel";
import type { RunningContext } from "./readingVariables";

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

const numberOf = (stepId: string) => ({ s1: "1", s3: "4" })[stepId] ?? "?";
const frameName = () => "Pagamentos";

function renderPanel(props: Partial<Parameters<typeof FlowVariablesPanel>[0]> = {}) {
  return render(
    <FlowVariablesPanel
      sends={null}
      expected={null}
      context={EMPTY}
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

  it("shows the body without being asked, and the state only when asked", () => {
    renderPanel({
      sends: { json: { a: 1 }, text: "{}", direction: "request" },
      context: context({
        size: 1,
        groups: [
          { frameId: null, entries: [{ key: "x", value: "1", fromStepId: "s1", frameId: null }] },
        ],
      }),
    });

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.queryByTestId("flow-variables-entry")).toBeNull();

    fireEvent.click(screen.getByTestId("flow-variables-toggle-state"));

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
    fireEvent.click(screen.getByTestId("flow-variables-toggle-state"));

    expect(screen.getByTestId("flow-variables-origin").textContent).toContain("1");
  });

  it("moves the reading there when chosen", () => {
    const onGoToStep = vi.fn();
    renderPanel({ ...withState, onGoToStep });
    fireEvent.click(screen.getByTestId("flow-variables-toggle-state"));

    fireEvent.click(screen.getByTestId("flow-variables-origin"));

    expect(onGoToStep).toHaveBeenCalledWith("s1");
  });

  it("marks the keys the step consumes apart from the rest", () => {
    renderPanel(withState);
    fireEvent.click(screen.getByTestId("flow-variables-toggle-state"));

    expect(screen.getByTestId("flow-variables-entry").textContent).toContain("↗");
  });

  it("reports a key nothing sets", () => {
    renderPanel({ context: context({ unsetReads: ["cupom_id"], reads: ["cupom_id"] }) });
    fireEvent.click(screen.getByTestId("flow-variables-toggle-state"));

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
