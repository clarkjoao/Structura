import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { FlowStep } from "@/features/diagram";
import { StepContextEditor } from "./StepContextEditor";
import { formatSets, parseReads, parseSets, setsFromPayload } from "./stepContext";

/**
 * Getting a context onto a step at all.
 *
 * The field, its three consumers and the whole running object shipped with no
 * way for anyone to write one — the reading could fold values it was never
 * going to be given. These are about the way in.
 */

function step(partial: Partial<FlowStep> = {}): FlowStep {
  return { id: "s1", type: "action", ...partial } as FlowStep;
}

function renderEditor(partial: Partial<FlowStep> = {}) {
  const onChange = vi.fn();
  render(<StepContextEditor step={step(partial)} onChange={onChange} />);
  return onChange;
}

describe("a small object reads as lines of text", () => {
  it("parses one key: value per line", () => {
    expect(parseSets("score: 0.12\ncliente_id: c_8f3a")).toEqual({
      score: "0.12",
      cliente_id: "c_8f3a",
    });
  });

  it("splits on the first colon only, so a value may hold one", () => {
    expect(parseSets("url: https://x.com/a")).toEqual({ url: "https://x.com/a" });
  });

  it("keeps a key still being typed rather than dropping the line", () => {
    expect(parseSets("score")).toEqual({ score: "" });
  });

  it("comes back as nothing when nothing was written", () => {
    expect(parseSets("   \n\n")).toBeUndefined();
  });

  it("round-trips what it formatted", () => {
    const sets = { score: "0.12", ok: "true" };

    expect(parseSets(formatSets(sets))).toEqual(sets);
  });

  it("reads a comma-separated list of keys", () => {
    expect(parseReads("cliente.cpf , pedido.bin ")).toEqual(["cliente.cpf", "pedido.bin"]);
    expect(parseReads("  ")).toBeUndefined();
  });
});

describe("the step's own body can fill in for typing", () => {
  it("takes the top-level keys of a JSON object", () => {
    expect(setsFromPayload('{"cliente_id":"c_8f3a","valor":24900}')).toEqual({
      cliente_id: "c_8f3a",
      valor: "24900",
    });
  });

  it("keeps a nested value as the shape it is", () => {
    expect(setsFromPayload('{"cartao":{"bin":"515590"}}')).toEqual({
      cartao: '{"bin":"515590"}',
    });
  });

  it("offers nothing for prose, an array, or a body that is not there", () => {
    expect(setsFromPayload("cartão tokenizado")).toBeUndefined();
    expect(setsFromPayload("[1,2]")).toBeUndefined();
    expect(setsFromPayload(undefined)).toBeUndefined();
  });
});

describe("the editor writes a context onto the step", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("writes the values typed into it", () => {
    const onChange = renderEditor();

    fireEvent.change(screen.getByTestId("step-context-sets"), {
      target: { value: "score: 0.12" },
    });

    expect(onChange).toHaveBeenCalledWith({ sets: { score: "0.12" } });
  });

  it("writes the keys the step consumes", () => {
    const onChange = renderEditor();

    fireEvent.change(screen.getByTestId("step-context-reads"), {
      target: { value: "cliente.cpf" },
    });

    expect(onChange).toHaveBeenCalledWith({ reads: ["cliente.cpf"] });
  });

  it("keeps what was already there when one field changes", () => {
    const onChange = renderEditor({ context: { reads: ["cliente.cpf"] } });

    fireEvent.change(screen.getByTestId("step-context-sets"), {
      target: { value: "score: 0.12" },
    });

    expect(onChange).toHaveBeenCalledWith({
      reads: ["cliente.cpf"],
      sets: { score: "0.12" },
    });
  });

  it("drops the whole field once its last member is cleared", () => {
    const onChange = renderEditor({ context: { sets: { score: "0.12" } } });

    fireEvent.change(screen.getByTestId("step-context-sets"), { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("survives being typed one character at a time", () => {
    // The bug this guards: parsing each keystroke and formatting the result
    // back into the field turned `score: 0.12` into the key `s` holding
    // `core:0.12`, because `s` became a whole `s: ` line on the first stroke.
    const onChange = vi.fn();
    render(<StepContextEditor step={step()} onChange={onChange} />);
    const field = screen.getByTestId("step-context-sets");

    const typed = "score: 0.12";
    for (let at = 1; at <= typed.length; at++) {
      fireEvent.change(field, { target: { value: typed.slice(0, at) } });
    }

    expect(onChange).toHaveBeenLastCalledWith({ sets: { score: "0.12" } });
    expect((field as HTMLTextAreaElement).value).toBe(typed);
  });

  it("lets a comma be typed into the keys it consumes", () => {
    const onChange = vi.fn();
    render(<StepContextEditor step={step()} onChange={onChange} />);
    const field = screen.getByTestId("step-context-reads");

    const typed = "a,b";
    for (let at = 1; at <= typed.length; at++) {
      fireEvent.change(field, { target: { value: typed.slice(0, at) } });
    }

    expect((field as HTMLInputElement).value).toBe(typed);
    expect(onChange).toHaveBeenLastCalledWith({ reads: ["a", "b"] });
  });

  it("fills the values from the step's own body in one gesture", () => {
    const onChange = renderEditor({ payload: '{"cliente_id":"c_8f3a"}' });

    fireEvent.click(screen.getByTestId("step-context-from-payload"));

    expect(onChange).toHaveBeenCalledWith({ sets: { cliente_id: "c_8f3a" } });
  });

  it("offers nothing to take when the body is prose", () => {
    renderEditor({ payload: "cartão tokenizado" });

    expect(screen.queryByTestId("step-context-from-payload")).toBeNull();
  });

  it("asks what comes back only where something can", () => {
    renderEditor({ connectionId: "c1", payloadDirection: "request" });
    expect(screen.getByTestId("step-context-expects")).toBeTruthy();
  });

  it("does not ask what comes back on a response", () => {
    renderEditor({ connectionId: "c1", payloadDirection: "response" });
    expect(screen.queryByTestId("step-context-expects")).toBeNull();
  });

  it("does not ask what comes back on a step that makes no call", () => {
    renderEditor({ componentId: "a" });
    expect(screen.queryByTestId("step-context-expects")).toBeNull();
  });
});
