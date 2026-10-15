import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/diagram", () => ({
  useDiagramStore: {
    getState: () => ({
      pushHistoryBoundary: () => undefined,
      updateNodeLayout: () => undefined,
      activeDiagramId: null,
      diagrams: {},
    }),
  },
}));

import { useLLMStore } from "./store";
import { loadConnections } from "./llm-storage";

const customAnthropic = {
  name: "Gateway",
  mode: "direct",
  provider: "custom",
  apiKey: "sk-gw",
  model: "claude-sonnet-5-5",
  baseUrl: "https://gateway.example.com/v1",
  customProtocol: "anthropic",
} as const;

beforeEach(() => {
  localStorage.clear();
  useLLMStore.setState({
    connections: [],
    activeConnectionId: "",
    config: { mode: "proxy", provider: "openai", apiKey: "", model: "gpt-4o-mini" },
    isLoading: false,
  });
});

afterEach(() => {
  localStorage.clear();
});

describe("custom connection protocol", () => {
  it("reaches the request config when the connection is selected", () => {
    const created = useLLMStore.getState().createConnection(customAnthropic);
    useLLMStore.getState().setActiveConnection(created.id);
    expect(useLLMStore.getState().config.customProtocol).toBe("anthropic");
  });

  it("survives a save and reload", async () => {
    useLLMStore.getState().createConnection(customAnthropic);
    const { connections } = await loadConnections();
    expect(connections.find((c) => c.name === "Gateway")?.customProtocol).toBe("anthropic");
  });

  it("is kept when the active connection's config is updated", async () => {
    const created = useLLMStore.getState().createConnection(customAnthropic);
    useLLMStore.getState().setActiveConnection(created.id);
    useLLMStore.getState().setLLMConfig({ ...useLLMStore.getState().config, model: "other" });
    const { connections } = await loadConnections();
    expect(connections.find((c) => c.id === created.id)).toMatchObject({
      model: "other",
      customProtocol: "anthropic",
    });
  });

  it("drops an unknown stored protocol", async () => {
    localStorage.setItem(
      "structura_llm-connections",
      JSON.stringify({
        connections: [{ ...customAnthropic, id: "x", customProtocol: "grpc" }],
        activeConnectionId: "x",
      }),
    );
    const { connections } = await loadConnections();
    expect(connections[0]?.customProtocol).toBeUndefined();
  });
});
