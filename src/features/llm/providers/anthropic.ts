import type { ChatMessage, LLMConfig } from "../types";

interface AnthropicMessageResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

export async function sendMessage(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      system: systemPrompt,
      max_tokens: 1200,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed (${response.status})`);
  }

  const data = (await response.json()) as AnthropicMessageResponse;
  const textBlock = data.content?.find((block) => block.type === "text");
  return textBlock?.text ?? "";
}

