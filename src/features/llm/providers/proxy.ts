import type { ChatMessage, LLMConfig } from "../types";
import { LLMProviderError } from "../errors";

const DEFAULT_PROXY_URL = import.meta.env.VITE_LLM_PROXY_URL ?? "http://localhost:3000";
const DEFAULT_PROXY_PATH = import.meta.env.VITE_LLM_PROXY_PATH ?? "/llm/chat";

interface ProxyResponse {
  message?: string;
}

export function getProxyEndpoint(): string {
  const baseUrl = DEFAULT_PROXY_URL.endsWith("/")
    ? DEFAULT_PROXY_URL.slice(0, -1)
    : DEFAULT_PROXY_URL;
  const path = DEFAULT_PROXY_PATH.startsWith("/")
    ? DEFAULT_PROXY_PATH
    : `/${DEFAULT_PROXY_PATH}`;
  return `${baseUrl}${path}`;
}

export async function sendMessage(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (chunk: string) => void,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(getProxyEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: config.provider,
        model: config.model,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        systemPrompt,
      }),
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown network error";
    throw new LLMProviderError(null, "proxy", rawMessage);
  }

  if (!response.ok) {
    throw new LLMProviderError(response.status, "proxy", await response.text());
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
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
            message?: string;
            delta?: { text?: string };
            text?: string;
          };
          const delta =
            parsedData.choices?.[0]?.delta?.content ??
            parsedData.delta?.text ??
            parsedData.text ??
            parsedData.message ??
            "";
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

  const data = (await response.json()) as ProxyResponse;
  const fullText = data.message ?? "";
  if (fullText) {
    onChunk(fullText);
  }
  return fullText;
}

