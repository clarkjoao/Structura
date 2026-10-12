/**
 * Test helpers: OpenAI-compatible chat-completion streams, the wire format the
 * proxy and custom connections speak through the AI SDK.
 */
const encoder = new TextEncoder();

export function chatChunk(delta: Record<string, unknown>, finishReason: string | null = null) {
  return `data: ${JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 0,
    model: "test-model",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;
}

const DONE = "data: [DONE]\n\n";

function sse(body: ReadableStream<Uint8Array> | string): Response {
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

/** A complete streamed reply. */
export function replyWith(text: string, finishReason = "stop"): Response {
  return sse(chatChunk({ role: "assistant", content: text }) + chatChunk({}, finishReason) + DONE);
}

/** A reply the test drives chunk by chunk; `push` past the last chunk finishes it. */
export function controllableReply(chunks: string[]): {
  response: Response;
  push: () => void;
  fail: () => void;
} {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  let index = 0;
  return {
    response: sse(body),
    push: () => {
      const chunk = chunks[index];
      index += 1;
      if (chunk === undefined) {
        controller?.enqueue(encoder.encode(chatChunk({}, "stop") + DONE));
        controller?.close();
        return;
      }
      controller?.enqueue(encoder.encode(chatChunk({ content: chunk })));
    },
    // What a real fetch body does when its request is aborted.
    fail: () => controller?.error(new DOMException("The operation was aborted.", "AbortError")),
  };
}
