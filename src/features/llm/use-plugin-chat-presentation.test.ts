import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { registerChatContextContribution } from "@/features/plugins/chat-context-registry";
import { usePluginChatPresentation } from "./use-plugin-chat-presentation";

let unregister: (() => void) | undefined;
afterEach(() => unregister?.());

describe("usePluginChatPresentation (API 1.8)", () => {
  it("follows a context as it starts and stops applying", () => {
    let open = false;
    let notify = () => {};
    unregister = registerChatContextContribution({
      id: "opscr/chat",
      appliesTo: () => open,
      presentation: ({ diagramId }) => ({
        title: `opscr · ${diagramId}`,
        suggestions: ["Add a cache"],
      }),
      subscribe: (listener) => {
        notify = listener;
        return () => (notify = () => {});
      },
      systemPrompt: () => "",
      handleReply: () => ({ reply: "" }),
    });
    const { result } = renderHook(() => usePluginChatPresentation("d1"));
    expect(result.current).toBeNull();

    act(() => {
      open = true;
      notify();
    });
    expect(result.current).toEqual({ title: "opscr · d1", suggestions: ["Add a cache"] });

    act(() => unregister?.());
    expect(result.current).toBeNull();
  });

  it("is null without a diagram or when the context has no presentation", () => {
    unregister = registerChatContextContribution({
      id: "plain/chat",
      appliesTo: () => true,
      systemPrompt: () => "",
      handleReply: () => ({ reply: "" }),
    });
    expect(renderHook(() => usePluginChatPresentation("d1")).result.current).toBeNull();
    expect(renderHook(() => usePluginChatPresentation(null)).result.current).toBeNull();
  });
});
