import type { ChatMessage, LLMCompletion, LLMConfig } from "../types";
import { sendOpenAICompatibleMessage } from "./openai-compatible";

const OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Output ceiling for a single response.
 *
 * Measured 2026-08-27 against the live API, by asking for `max_tokens: 999999`
 * and reading the limit the 400 names: gpt-4o and gpt-4o-mini cap at 16384
 * completion tokens, gpt-4.1 and gpt-4.1-mini at 32768. One constant has to fit
 * the smallest supported preset, so 16000 it is — accepted by all four (HTTP 200
 * positive control in `docs/fatia1-transporte/measure-openai-max-tokens.json`).
 *
 * The previous 3000 cut a ~40-node diagram mid-string every time. This buys
 * headroom, it does not remove the failure mode: a big enough diagram will reach
 * any ceiling, which is why truncation is now detected and reported explicitly.
 */
const OPENAI_MAX_OUTPUT_TOKENS = 16000;

export async function sendMessage(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (chunk: string) => void,
): Promise<LLMCompletion> {
  return sendOpenAICompatibleMessage(
    {
      baseUrl: OPENAI_BASE_URL,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: {
        model: config.model,
        max_tokens: OPENAI_MAX_OUTPUT_TOKENS,
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

/** Exposed so a test can assert the shipped ceiling, not just the wiring. */
export const OPENAI_MAX_OUTPUT_TOKENS_FOR_TEST = OPENAI_MAX_OUTPUT_TOKENS;
