import type { PluginChatContext, PluginChatTurnResult } from "@/features/plugins/plugin.types";
import type { ChatMessage } from "./types";

/** Model calls per user message on a plugin-owned diagram: the reply plus two fixes. */
export const PLUGIN_TURN_MAX_ATTEMPTS = 3;

export interface PluginChatTurn {
  context: PluginChatContext;
  diagramId: string;
  locale: "en" | "pt-BR";
  /** The thread so far, ending with the user's message. */
  history: ChatMessage[];
  send: (
    messages: ChatMessage[],
    systemPrompt: string,
    onChunk: (chunk: string) => void,
  ) => Promise<{ text: string }>;
  /** Streamed text of the current attempt (restarts at each retry). */
  onText: (text: string) => void;
}

const turnMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  timestamp: Date.now(),
});

/**
 * One user message on a diagram a plugin's chat context owns (API 1.6): the plugin's system
 * prompt, the model's reply handed to the plugin, and — while the plugin asks for a retry and
 * attempts remain — its retry text sent back with the model's reply. Returns the final result.
 */
export async function runPluginChatTurn(turn: PluginChatTurn): Promise<PluginChatTurnResult> {
  let messages = turn.history;
  for (let attempt = 0; ; attempt += 1) {
    const input = {
      diagramId: turn.diagramId,
      locale: turn.locale,
      attempt,
      maxAttempts: PLUGIN_TURN_MAX_ATTEMPTS,
    };
    const systemPrompt = await turn.context.systemPrompt(input);
    let streamed = "";
    turn.onText("");
    const { text } = await turn.send(messages, systemPrompt, (chunk) => {
      streamed += chunk;
      turn.onText(streamed);
    });
    const result = await turn.context.handleReply(text, input);
    if (!result.retry || attempt >= PLUGIN_TURN_MAX_ATTEMPTS - 1) return result;
    messages = [...messages, turnMessage("assistant", text), turnMessage("user", result.retry)];
  }
}
