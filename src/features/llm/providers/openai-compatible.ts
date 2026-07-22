import { LLMProviderError } from "../errors";

interface OpenAICompatibleDelta {
  choices?: Array<{ delta?: { content?: unknown } }>;
}

interface OpenAICompatibleRequest {
  baseUrl: string;
  headers: Record<string, string>;
  body: unknown;
  errorOrigin: "openai" | "custom";
}

export async function sendOpenAICompatibleMessage(
  request: OpenAICompatibleRequest,
  onChunk: (chunk: string) => void,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(request.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...request.headers },
      body: JSON.stringify(request.body),
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown network error";
    throw new LLMProviderError(null, request.errorOrigin, rawMessage);
  }

  if (!response.ok) {
    throw new LLMProviderError(response.status, request.errorOrigin, await response.text());
  }

  if (!response.body) {
    return "";
  }

  return readOpenAICompatibleStream(response.body, onChunk);
}

export async function readOpenAICompatibleStreamForTest(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: string) => void,
): Promise<string> {
  return readOpenAICompatibleStream(body, onChunk);
}

async function readOpenAICompatibleStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: string) => void,
): Promise<string> {
  const reader = body.getReader();
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
        const parsed = JSON.parse(trimmedLine.slice(6)) as OpenAICompatibleDelta;
        const delta = parsed.choices?.[0]?.delta?.content;
        const text = typeof delta === "string" ? delta : "";
        if (text) {
          fullText += text;
          onChunk(text);
        }
      } catch {}
    }
  }

  return fullText;
}
