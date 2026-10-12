import {
  createRequestTimeout,
  fetchLLM,
  readLLMChunk,
  type LLMErrorContext,
  type RequestTimeout,
} from "../errors";
import type { LLMCompletion, LLMStopReason } from "../types";

interface OpenAICompatibleDelta {
  choices?: Array<{ delta?: { content?: unknown }; finish_reason?: unknown }>;
}

interface OpenAICompatibleRequest {
  baseUrl: string;
  headers: Record<string, string>;
  body: unknown;
  errorOrigin: "openai" | "custom";
}

/**
 * Maps the OpenAI `finish_reason` onto the transport-level stop reason. Anything
 * we do not recognise stays `unknown` rather than being optimistically read as a
 * clean stop — a stop reason we cannot interpret is not evidence of completeness.
 */
export function toStopReason(finishReason: unknown): LLMStopReason {
  if (finishReason === "length") {
    return "length";
  }
  if (finishReason === "stop") {
    return "stop";
  }
  return "unknown";
}

export async function sendOpenAICompatibleMessage(
  request: OpenAICompatibleRequest,
  onChunk: (chunk: string) => void,
): Promise<LLMCompletion> {
  const context: LLMErrorContext = { mode: "direct", provider: request.errorOrigin };
  const timeout = createRequestTimeout();
  try {
    const response = await fetchLLM(
      request.baseUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...request.headers },
        body: JSON.stringify(request.body),
      },
      context,
      timeout,
    );

    if (!response.body) {
      return { text: "", stopReason: "unknown" };
    }

    return await readOpenAICompatibleStream(response.body, onChunk, context, timeout);
  } finally {
    timeout.clear();
  }
}

export async function readOpenAICompatibleStreamForTest(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: string) => void,
): Promise<LLMCompletion> {
  const timeout = createRequestTimeout();
  try {
    return await readOpenAICompatibleStream(
      body,
      onChunk,
      { mode: "direct", provider: "openai" },
      timeout,
    );
  } finally {
    timeout.clear();
  }
}

async function readOpenAICompatibleStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: string) => void,
  context: LLMErrorContext,
  timeout: RequestTimeout,
): Promise<LLMCompletion> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  // The reason arrives on a late chunk whose delta is empty, so it is tracked
  // separately from the text and the last non-null one wins.
  let stopReason: LLMStopReason = "unknown";

  while (true) {
    const { done, value } = await readLLMChunk(reader, context, timeout);
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
        const choice = parsed.choices?.[0];
        const delta = choice?.delta?.content;
        const text = typeof delta === "string" ? delta : "";
        if (text) {
          fullText += text;
          onChunk(text);
        }
        if (choice?.finish_reason != null) {
          stopReason = toStopReason(choice.finish_reason);
        }
      } catch (err) {
        console.warn("[OpenAICompatibleProvider] Error processing stream:", err);
      }
    }
  }

  return { text: fullText, stopReason };
}
