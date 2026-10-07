import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/diagram", () => ({
  useDiagramStore: {
    getState: () => ({
      pushHistoryBoundary: () => undefined,
      updateNodeLayout: () => undefined,
      activeDiagramId: "bound",
      diagrams: { bound: { viewport: { x: 0, y: 0, zoom: 1 } } },
    }),
  },
}));

const sendOpenAIMessage = vi.fn();
vi.mock("./providers/openai", () => ({
  sendMessage: (...args: unknown[]) => sendOpenAIMessage(...args),
}));

import { registerChatContextContribution } from "@/features/plugins/chat-context-registry";
import { useLLMStore } from "./store";
import { resetLLMStorageForTests } from "./llm-storage";

let unregister: (() => void) | undefined;

beforeEach(() => {
  localStorage.clear();
  resetLLMStorageForTests();
  sendOpenAIMessage.mockReset();
  useLLMStore.setState({
    config: { mode: "direct", provider: "openai", apiKey: "k", model: "gpt-4.1" },
    activeDiagramId: "bound",
    activeThreadId: "thread-1",
    messages: [],
    pendingSuggestions: [],
    pendingPreviews: [],
    pendingAnalysis: null,
    streamingContent: null,
    isLoading: false,
    error: null,
  });
});

afterEach(() => unregister?.());

describe("chat on a diagram a plugin owns (API 1.6)", () => {
  it("uses the plugin's prompt and reply, and leaves no diagram suggestion", async () => {
    const handleReply = vi.fn(() => ({ reply: "Added price-cache." }));
    unregister = registerChatContextContribution({
      id: "opscr/chat",
      appliesTo: (id) => id === "bound",
      systemPrompt: () => "OPSCR SYSTEM",
      handleReply,
    });
    sendOpenAIMessage.mockResolvedValue({ text: "```yaml file=a.opscr.yaml\n...\n```" });

    await useLLMStore.getState().sendMessage("add a cache", "IGNORED DIAGRAM CONTEXT");

    expect(sendOpenAIMessage.mock.calls[0]![2]).toBe("OPSCR SYSTEM");
    expect(handleReply).toHaveBeenCalledTimes(1);
    const { messages, pendingSuggestions, isLoading } = useLLMStore.getState();
    expect(messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "add a cache"],
      ["assistant", "Added price-cache."],
    ]);
    expect(pendingSuggestions).toEqual([]);
    expect(isLoading).toBe(false);
  });

  it("keeps the built-in chat when no context applies", async () => {
    unregister = registerChatContextContribution({
      id: "opscr/chat",
      appliesTo: () => false,
      systemPrompt: () => "OPSCR SYSTEM",
      handleReply: () => ({ reply: "x" }),
    });
    sendOpenAIMessage.mockResolvedValue({ text: "Just text." });
    await useLLMStore.getState().sendMessage("hi", "DIAGRAM CONTEXT");
    expect(sendOpenAIMessage.mock.calls[0]![2]).not.toBe("OPSCR SYSTEM");
  });
});
