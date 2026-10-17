import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLLMStore } from "../store";
import { useCommandActions } from "./useCommandActions";

beforeEach(() => {
  localStorage.clear();
  useLLMStore.setState({
    threadsByDiagram: {},
    activeDiagramId: null,
    activeThreadId: "",
    messages: [],
    pendingSuggestions: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("action commands", () => {
  it("/clear starts a new conversation and keeps the current one in history", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const first = useLLMStore.getState().createThread("d1", "First question");
    const { result } = renderHook(() => useCommandActions());

    result.current.newConversation();

    const threads = useLLMStore.getState().threadsByDiagram["d1"]?.threads ?? [];
    expect(threads).toHaveLength(2);
    expect(threads.some((thread) => thread.id === first.id)).toBe(true);
    expect(useLLMStore.getState().activeThreadId).not.toBe(first.id);
  });

  it("/copy writes the visible form of command messages", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    useLLMStore.setState({
      messages: [
        {
          id: "u",
          role: "user",
          parts: [{ type: "text", text: "the database" }],
          timestamp: 0,
          command: { id: "review", name: "review" },
        },
      ],
    });
    const { result } = renderHook(() => useCommandActions());
    await result.current.copyConversation();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/review the database"));
  });
});
