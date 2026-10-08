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
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));

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

describe("previewing a plugin reply (API 1.7)", () => {
  const register = (discard?: () => string | void) => {
    const keep = vi.fn();
    const discardSpy = discard ? vi.fn(discard) : undefined;
    unregister = registerChatContextContribution({
      id: "opscr/chat",
      appliesTo: () => true,
      systemPrompt: () => "S",
      handleReply: () => ({
        reply: "Added.",
        preview: {
          componentIds: ["c1"],
          connectionIds: ["e1"],
          title: "Added Cache/c",
          keep,
          ...(discardSpy ? { discard: discardSpy } : {}),
        },
      }),
    });
    sendOpenAIMessage.mockResolvedValue({ text: "x" });
    return { keep, discard: discardSpy };
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("shows the change as pending, focused and discardable", async () => {
    register(() => undefined);
    await useLLMStore.getState().sendMessage("add", "");
    const { pendingSuggestions, pendingPreviews } = useLLMStore.getState();
    expect(pendingSuggestions).toHaveLength(1);
    expect(pendingSuggestions[0]!.patch.description).toBe("Added Cache/c");
    expect(pendingPreviews).toEqual([
      {
        suggestionId: pendingSuggestions[0]!.id,
        nodeIds: ["c1"],
        edgeIds: ["e1"],
        focus: true,
        discardable: true,
      },
    ]);
  });

  it("Discard asks the plugin, and a refusal keeps the change", async () => {
    const { discard, keep } = register(() => "The text changed since");
    await useLLMStore.getState().sendMessage("add", "");
    const id = useLLMStore.getState().pendingSuggestions[0]!.id;
    useLLMStore.getState().rejectSuggestion(id);
    await flush();
    expect(discard).toHaveBeenCalledTimes(1);
    expect(keep).toHaveBeenCalledTimes(1);
    expect(useLLMStore.getState().pendingSuggestions[0]!.status).toBe("accepted");
    expect(useLLMStore.getState().pendingPreviews).toEqual([]);
  });

  it("Discard that succeeds marks it rejected without touching the diagram itself", async () => {
    const { discard } = register(() => undefined);
    await useLLMStore.getState().sendMessage("add", "");
    useLLMStore.getState().rejectSuggestion(useLLMStore.getState().pendingSuggestions[0]!.id);
    await flush();
    expect(discard).toHaveBeenCalledTimes(1);
    expect(useLLMStore.getState().pendingSuggestions[0]!.status).toBe("rejected");
  });

  it("a new message keeps the previous pending reply", async () => {
    const { keep } = register(() => undefined);
    await useLLMStore.getState().sendMessage("add", "");
    await useLLMStore.getState().sendMessage("and another", "");
    const statuses = useLLMStore.getState().pendingSuggestions.map((s) => s.status);
    expect(statuses).toEqual(["accepted", "pending"]);
    expect(keep).toHaveBeenCalledTimes(1);
  });
});
