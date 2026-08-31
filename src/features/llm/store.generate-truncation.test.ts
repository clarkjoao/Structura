import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/diagram", () => ({
  useDiagramStore: {
    getState: () => ({
      pushHistoryBoundary: () => undefined,
      updateNodeLayout: () => undefined,
      activeDiagramId: "diagram-store",
      diagrams: { "diagram-store": { viewport: { x: 0, y: 0, zoom: 1 } } },
    }),
  },
}));

const sendOpenAIMessage = vi.fn();
vi.mock("./providers/openai", () => ({
  sendMessage: (...args: unknown[]) => sendOpenAIMessage(...args),
}));

import i18n from "@/infrastructure/i18n";
import { useLLMStore } from "./store";
import { resetLLMStorageForTests } from "./llm-storage";
import en from "@/infrastructure/i18n/locales/en.json";

/** A ~40-node IR cut mid-string, the shape every failing Phase 0 run produced. */
const TRUNCATED_IR =
  '{"type":"c4-container","nodes":[{"id":"web","name":"Web App","semanticType":"container"},' +
  '{"id":"api","name":"API","semanticType":"container"},{"id":"db","name":"Orders D';

function lastMessage(): string {
  const messages = useLLMStore.getState().messages;
  return messages[messages.length - 1]?.content ?? "";
}

function resetStore(): void {
  useLLMStore.setState({
    connections: [],
    activeConnectionId: "",
    config: { mode: "direct", provider: "openai", apiKey: "k", model: "gpt-4.1" },
    threadsByDiagram: {},
    activeDiagramId: "diagram-store",
    activeThreadId: "thread-1",
    messages: [],
    pendingSuggestions: [],
    pendingPreviews: [],
    pendingAnalysis: null,
    streamingContent: null,
    isLoading: false,
    error: null,
  });
}

beforeEach(async () => {
  localStorage.clear();
  resetLLMStorageForTests();
  resetStore();
  sendOpenAIMessage.mockReset();
  await i18n.changeLanguage("en");
});

describe("/generate — a response cut at the output ceiling", () => {
  it("tells the user the diagram was truncated, not that the JSON is invalid", async () => {
    sendOpenAIMessage.mockResolvedValue({ text: TRUNCATED_IR, stopReason: "length" });

    await useLLMStore.getState().generateDiagramFromIR("a C4 diagram", "/generate a C4 diagram");

    const message = lastMessage();
    expect(message).toContain(en.llmChat.ir.truncated);
    expect(message).toContain(en.llmChat.ir.issue.responseTruncated);
    expect(message).not.toContain(en.llmChat.ir.issue.invalidJson);
    expect(message).not.toContain(en.llmChat.ir.invalid);
  });

  it("says what to do next, not only that it failed", async () => {
    sendOpenAIMessage.mockResolvedValue({ text: TRUNCATED_IR, stopReason: "length" });

    await useLLMStore.getState().generateDiagramFromIR("a C4 diagram", "/generate a C4 diagram");

    // The actionable half: generate in parts, or describe fewer elements.
    expect(lastMessage()).toMatch(/in parts|fewer elements/i);
  });

  it("keeps the two failures distinguishable: bad JSON with a clean stop still reads as bad JSON", async () => {
    sendOpenAIMessage.mockResolvedValue({ text: "not json at all", stopReason: "stop" });

    await useLLMStore.getState().generateDiagramFromIR("a C4 diagram", "/generate a C4 diagram");

    const message = lastMessage();
    expect(message).toContain(en.llmChat.ir.issue.invalidJson);
    expect(message).not.toContain(en.llmChat.ir.issue.responseTruncated);
  });

  it("produces two different messages for the two causes", async () => {
    sendOpenAIMessage.mockResolvedValue({ text: TRUNCATED_IR, stopReason: "length" });
    await useLLMStore.getState().generateDiagramFromIR("a C4 diagram", "/generate a C4 diagram");
    const truncatedMessage = lastMessage();

    resetStore();
    sendOpenAIMessage.mockResolvedValue({ text: TRUNCATED_IR, stopReason: "unknown" });
    await useLLMStore.getState().generateDiagramFromIR("a C4 diagram", "/generate a C4 diagram");
    const parseFailureMessage = lastMessage();

    // Same bytes on the wire; only the stop reason differs. If the message is
    // the same, the stop reason is not reaching the user.
    expect(truncatedMessage).not.toBe(parseFailureMessage);
  });

  it("leaves the store in a finished, non-loading state", async () => {
    sendOpenAIMessage.mockResolvedValue({ text: TRUNCATED_IR, stopReason: "length" });

    await useLLMStore.getState().generateDiagramFromIR("a C4 diagram", "/generate a C4 diagram");

    const state = useLLMStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.streamingContent).toBeNull();
    expect(state.lastGeneratedIR).toBeNull();
  });
});
