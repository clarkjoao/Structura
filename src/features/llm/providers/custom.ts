import type { LLMRequestMessage, LLMCompletion, LLMConfig } from "../types";
import { sendOpenAICompatibleMessage } from "./openai-compatible";

export async function sendMessage(
  config: LLMConfig,
  messages: LLMRequestMessage[],
  systemPrompt: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<LLMCompletion> {
  if (!config.baseUrl) {
    throw new Error("custom provider requires a baseUrl");
  }

  const authHeaderName = config.authHeader?.trim() || "Authorization";
  const headers: Record<string, string> = {
    [authHeaderName]:
      authHeaderName.toLowerCase() === "authorization" ? `Bearer ${config.apiKey}` : config.apiKey,
    ...(config.extraHeaders ?? {}),
  };

  const body = {
    model: config.model,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((message) => ({ role: message.role, content: message.content })),
    ],
    ...(config.extraParams ?? {}),
  };

  return sendOpenAICompatibleMessage(
    {
      baseUrl: config.baseUrl,
      headers,
      body,
      errorOrigin: "custom",
      signal,
    },
    onChunk,
  );
}
