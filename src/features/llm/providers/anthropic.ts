import type { ChatMessage, LLMCompletion, LLMConfig, LLMStopReason } from "../types";
import { LLMProviderError } from "../errors";

/**
 * Output ceiling for a single response.
 *
 * NOT measured against the live API: this app has no Anthropic connection
 * configured, so unlike the OpenAI ceiling this number was not confirmed by a
 * request. It is deliberately conservative — well under the documented output
 * limit of every model in `MODEL_PRESETS.anthropic` — and matches the OpenAI
 * constant so both providers truncate at the same size until someone can probe
 * this one the same way (`docs/fatia1-transporte/measure-openai-max-tokens.json`
 * records the method).
 */
const ANTHROPIC_MAX_OUTPUT_TOKENS = 16000;

/**
 * Maps Anthropic's `stop_reason` onto the transport-level stop reason.
 * `max_tokens` is the cut-off case; anything unrecognised stays `unknown`
 * rather than being read as a clean stop.
 */
export function toStopReason(stopReason: unknown): LLMStopReason {
  if (stopReason === "max_tokens") {
    return "length";
  }
  if (stopReason === "end_turn" || stopReason === "stop_sequence") {
    return "stop";
  }
  return "unknown";
}

export async function sendMessage(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (chunk: string) => void,
): Promise<LLMCompletion> {
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
        max_tokens: ANTHROPIC_MAX_OUTPUT_TOKENS,
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
    return { text: "", stopReason: "unknown" };
  }

  return readAnthropicStream(response.body, onChunk);
}

export async function readAnthropicStreamForTest(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: string) => void,
): Promise<LLMCompletion> {
  return readAnthropicStream(body, onChunk);
}

async function readAnthropicStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: string) => void,
): Promise<LLMCompletion> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  // Arrives on the `message_delta` event after the text is done, so it is
  // tracked separately and the last one that says anything wins.
  let stopReason: LLMStopReason = "unknown";

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
          delta?: { type?: string; text?: string; stop_reason?: unknown };
          message?: { stop_reason?: unknown };
        };
        if (parsedData.type === "content_block_delta" && parsedData.delta?.type === "text_delta") {
          const delta = parsedData.delta.text ?? "";
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        }
        const rawStopReason = parsedData.delta?.stop_reason ?? parsedData.message?.stop_reason;
        if (rawStopReason != null) {
          stopReason = toStopReason(rawStopReason);
        }
      } catch (err) {
        console.warn("[AnthropicProvider] Error processing stream:", err);
      }
    }
  }

  return { text: fullText, stopReason };
}

/** Exposed so a test can assert the shipped ceiling, not just the wiring. */
export const ANTHROPIC_MAX_OUTPUT_TOKENS_FOR_TEST = ANTHROPIC_MAX_OUTPUT_TOKENS;
