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
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((message) => ({ role: message.role, content: message.content })),
        ],
      }),
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown network error";
    throw new LLMProviderError(null, "openai", rawMessage);
  }

  if (!response.ok) {
    throw new LLMProviderError(response.status, "openai", await response.text());
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
      if (trimmedLine === "data: [DONE]") {
        continue;
      }
      try {
        const parsedData = JSON.parse(trimmedLine.slice(6)) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsedData.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          fullText += delta;
          onChunk(delta);
        }
      } catch {
        
      }
    }
  }

  return fullText;
}

