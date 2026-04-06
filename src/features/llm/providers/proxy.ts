import type { ChatMessage, LLMConfig } from "../types";

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
): Promise<string> {
  const response = await fetch(getProxyEndpoint(), {
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

  if (!response.ok) {
    throw new Error(`Proxy request failed (${response.status})`);
  }

  const data = (await response.json()) as ProxyResponse;
  return data.message ?? "";
}

