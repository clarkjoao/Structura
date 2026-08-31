import { describe, expect, it, vi } from "vitest";
import { readOpenAICompatibleStreamForTest } from "./openai-compatible";
import { readAnthropicStreamForTest } from "./anthropic";
import { OPENAI_MAX_OUTPUT_TOKENS_FOR_TEST, sendMessage as sendOpenAIMessage } from "./openai";
import { ANTHROPIC_MAX_OUTPUT_TOKENS_FOR_TEST } from "./anthropic";
import type { LLMConfig } from "../types";

function streamOf(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

/**
 * Shapes copied from real streams, not invented: the reason arrives on a late
 * chunk whose delta is empty, which is exactly why reading only `delta.content`
 * lost it.
 */
describe("openai-compatible stream: stop reason", () => {
  it("reports `length` when the provider cut the response at its ceiling", async () => {
    const body = streamOf(
      'data: {"choices":[{"delta":{"content":"{\\"type\\":\\"c4-context\\",\\"nodes\\":[{\\"id\\":\\"a\\",\\"lab"},"finish_reason":null}]}\n\n' +
        'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n' +
        "data: [DONE]\n",
    );
    const result = await readOpenAICompatibleStreamForTest(body, () => {});
    expect(result.stopReason).toBe("length");
    // The text is still handed back — the caller decides what to do with it.
    expect(result.text.startsWith('{"type":"c4-context"')).toBe(true);
  });

  it("reports `stop` on a natural finish", async () => {
    const body = streamOf(
      'data: {"choices":[{"delta":{"content":"done"},"finish_reason":null}]}\n\n' +
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
        "data: [DONE]\n",
    );
    expect(await readOpenAICompatibleStreamForTest(body, () => {})).toEqual({
      text: "done",
      stopReason: "stop",
    });
  });

  it("reports `unknown` when no finish_reason ever arrives", async () => {
    const body = streamOf('data: {"choices":[{"delta":{"content":"done"}}]}\n\ndata: [DONE]\n');
    expect((await readOpenAICompatibleStreamForTest(body, () => {})).stopReason).toBe("unknown");
  });

  it("does not read an unrecognised finish_reason as a clean stop", async () => {
    const body = streamOf('data: {"choices":[{"delta":{},"finish_reason":"content_filter"}]}\n\n');
    expect((await readOpenAICompatibleStreamForTest(body, () => {})).stopReason).toBe("unknown");
  });
});

describe("anthropic stream: stop reason", () => {
  it("maps stop_reason=max_tokens to `length`", async () => {
    const body = streamOf(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"{\\"type\\":\\"c4"}}\n\n' +
        'data: {"type":"message_delta","delta":{"stop_reason":"max_tokens","stop_sequence":null}}\n\n',
    );
    const result = await readAnthropicStreamForTest(body, () => {});
    expect(result.stopReason).toBe("length");
    expect(result.text).toBe('{"type":"c4');
  });

  it("maps stop_reason=end_turn to `stop`", async () => {
    const body = streamOf(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\n' +
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
    );
    expect(await readAnthropicStreamForTest(body, () => {})).toEqual({
      text: "ok",
      stopReason: "stop",
    });
  });
});

/**
 * The ceiling has to clear a real diagram, not a round number that looks big.
 *
 * Measured 2026-08-27 against the live API with the app's own system prompt and
 * the verbatim Case A / Case B prompts from the Phase 0 baseline: a complete
 * ~40-node diagram costs 3235 completion tokens in C4 and 3610 in AWS, both with
 * `finish_reason: "stop"`. Evidence in
 * `docs/fatia1-transporte/measure-completion-tokens.json`.
 *
 * These are counted tokens, not an estimate from character count. An earlier
 * version of this block divided characters by four and concluded a 40-node
 * diagram needed 2250 tokens, which is why it stayed green when the ceiling was
 * mutated back to 3000. Dense IR JSON runs at about 3 chars/token.
 */
describe("output ceiling", () => {
  const MEASURED_TOKENS_FOR_40_NODES = 3_610;
  /**
   * "About 40 nodes" is a request, not a contract — the model lands anywhere
   * near it, and the cost scales with what it decides to emit. Barely clearing
   * the measured number would put the next slightly bigger diagram back where
   * this slice started.
   */
  const REQUIRED_HEADROOM = 2;

  it("openai clears a measured ~40-node diagram, with headroom", () => {
    expect(OPENAI_MAX_OUTPUT_TOKENS_FOR_TEST).toBeGreaterThanOrEqual(
      MEASURED_TOKENS_FOR_40_NODES * REQUIRED_HEADROOM,
    );
  });

  it("anthropic clears a measured ~40-node diagram, with headroom", () => {
    expect(ANTHROPIC_MAX_OUTPUT_TOKENS_FOR_TEST).toBeGreaterThanOrEqual(
      MEASURED_TOKENS_FOR_40_NODES * REQUIRED_HEADROOM,
    );
  });

  /**
   * Measured the same day: the smallest ceiling across the four supported
   * OpenAI presets is 16384 (gpt-4o, gpt-4o-mini). Asking for more than a model
   * allows is a 400, not a truncation, so the shipped value must stay under it.
   */
  it("openai stays under the smallest supported model's ceiling", () => {
    expect(OPENAI_MAX_OUTPUT_TOKENS_FOR_TEST).toBeLessThanOrEqual(16_384);
  });

  it("sends the ceiling on the wire", async () => {
    const fetchSpy = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('data: {"choices":[{"delta":{"content":"x"},"finish_reason":"stop"}]}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const config: LLMConfig = {
      mode: "direct",
      provider: "openai",
      apiKey: "k",
      model: "gpt-4.1",
    };
    await sendOpenAIMessage(config, [], "system", () => {});

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body)) as { max_tokens?: number };
    expect(body.max_tokens).toBe(OPENAI_MAX_OUTPUT_TOKENS_FOR_TEST);

    vi.unstubAllGlobals();
  });
});
