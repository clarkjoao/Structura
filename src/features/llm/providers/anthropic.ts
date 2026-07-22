import type { ChatMessage, LLMConfig } from "../types";
import { LLMProviderError } from "../errors";

export async function sendMessage(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (chunk: string) => void,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        system: systemPrompt,
        max_tokens: 3000,
        stream: true,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown network error";
    throw new LLMProviderError(null, "anthropic", rawMessage);
  }

  if (!response.ok) {
    throw new LLMProviderError(response.status, "anthropic", await response.text());
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith("data: ")) {
        continue;
      }
      try {
        const parsedData = JSON.parse(trimmedLine.slice(6)) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (parsedData.type === "content_block_delta" && parsedData.delta?.type === "text_delta") {
          const delta = parsedData.delta.text ?? "";
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        }
      } catch (err) {
        console.warn("[AnthropicProvider] Error processing stream:", err);
      }
    }
  }

  return fullText;
}
