import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import i18n from "@/infrastructure/i18n";
import { useLLMStore } from "@/features/llm";
import { ModelPicker } from "./ModelPicker";

beforeEach(() => {
  localStorage.clear();
  useLLMStore.setState({ connections: [], activeConnectionId: "" });
  useLLMStore.getState().createConnection({
    name: "Team proxy",
    mode: "proxy",
    provider: "openai",
    apiKey: "",
    model: "team-small",
    models: ["team-large", "team-small"],
  });
});

describe("ModelPicker", () => {
  it("lists the active connection's models and switches the selected one", () => {
    render(<ModelPicker />);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("llmChat.modelPicker.label") }));
    fireEvent.click(screen.getByText("team-large"));
    const state = useLLMStore.getState();
    const active = state.connections.find((c) => c.id === state.activeConnectionId);
    expect(active?.model).toBe("team-large");
    expect(state.config.model).toBe("team-large");
  });
});
