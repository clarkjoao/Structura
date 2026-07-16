import type { ChatMessage, LLMConfig } from "../types";
import { sendOpenAICompatibleMessage } from "./openai-compatible";

const OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MAX_TOKENS = 3000;

export async function sendMessage(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (chunk: string) => void,
): Promise<string> {
  return sendOpenAICompatibleMessage(
    {
      baseUrl: OPENAI_BASE_URL,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: {
        model: config.model,
        max_tokens: OPENAI_MAX_TOKENS,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((message) => ({ role: message.role, content: message.content })),
        ],
      },
      errorOrigin: "openai",
    },
    onChunk,
  );
}
