import { describe, expect, it, vi } from "vitest";
import type { PluginChatContext } from "@/features/plugins/plugin.types";
import { PLUGIN_TURN_MAX_ATTEMPTS, runPluginChatTurn } from "./plugin-chat-turn";
import type { ChatMessage } from "./types";

const user: ChatMessage = { id: "u", role: "user", content: "add a cache", timestamp: 0 };

function setup(results: Array<{ reply: string; retry?: string }>) {
  const context: PluginChatContext = {
    id: "p/chat",
    appliesTo: () => true,
    systemPrompt: vi.fn((input) => `system #${input.attempt}`),
    handleReply: vi.fn(() => results.shift()!),
  };
  const send = vi.fn(async (_m: ChatMessage[], _s: string, onChunk: (c: string) => void) => {
    onChunk("re");
    onChunk("ply");
    return { text: `reply ${send.mock.calls.length}` };
  });
  const onText = vi.fn();
  const run = () =>
    runPluginChatTurn({ context, diagramId: "d", locale: "pt-BR", history: [user], send, onText });
  return { context, send, onText, run };
}

describe("runPluginChatTurn", () => {
  it("uses the plugin's system prompt and shows its reply", async () => {
    const { context, send, onText, run } = setup([{ reply: "Done" }]);
    expect(await run()).toBe("Done");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toEqual([user]);
    expect(send.mock.calls[0]![1]).toBe("system #0");
    expect(context.handleReply).toHaveBeenCalledWith("reply 1", {
      diagramId: "d",
      locale: "pt-BR",
      attempt: 0,
      maxAttempts: PLUGIN_TURN_MAX_ATTEMPTS,
    });
    expect(onText).toHaveBeenLastCalledWith("reply");
  });

  it("sends the retry back with the model's reply, then shows the final reply", async () => {
    const { send, run } = setup([{ reply: "x", retry: "fix line 3" }, { reply: "Fixed" }]);
    expect(await run()).toBe("Fixed");
    const second = send.mock.calls[1]![0];
    expect(second.map((m) => [m.role, m.content])).toEqual([
      ["user", "add a cache"],
      ["assistant", "reply 1"],
      ["user", "fix line 3"],
    ]);
  });

  it("stops after the last attempt even if the plugin still asks for a retry", async () => {
    const { send, run } = setup(
      Array.from({ length: 5 }, (_, i) => ({ reply: `r${i}`, retry: "again" })),
    );
    expect(await run()).toBe(`r${PLUGIN_TURN_MAX_ATTEMPTS - 1}`);
    expect(send).toHaveBeenCalledTimes(PLUGIN_TURN_MAX_ATTEMPTS);
  });
});
