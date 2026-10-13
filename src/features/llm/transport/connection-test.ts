import { LLMProviderError, createRequestTimeout, toLLMError, type LLMError } from "../errors";
import { DEFAULT_PROXY_BASE_URL, toOpenAICompatibleBaseUrl } from "../llm-storage";
import { getPresetsForProvider } from "../model-presets";
import type { LLMConfig } from "../types";

export type ConnectionTestResult =
  | {
      ok: true;
      models: string[];
      /** Round trip of the models request; null when the list comes from presets. */
      latencyMs: number | null;
      source: "endpoint" | "presets";
    }
  | { ok: false; error: LLMError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The ids in an OpenAI-compatible `GET /models` body (`{ data: [{ id }] }`). */
export function parseModelList(body: unknown): string[] {
  if (!isRecord(body) || !Array.isArray(body.data)) return [];
  return body.data
    .map((entry: unknown) => (isRecord(entry) && typeof entry.id === "string" ? entry.id : null))
    .filter((id): id is string => id !== null)
    .sort((a, b) => a.localeCompare(b));
}

/** The headers the transport would send for this connection. */
function requestHeaders(config: LLMConfig): Record<string, string> {
  if (config.mode === "proxy") {
    return config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {};
  }
  const authHeader = config.authHeader?.trim();
  const customHeader =
    authHeader && authHeader.toLowerCase() !== "authorization" ? authHeader : null;
  const auth: Record<string, string> = !config.apiKey
    ? {}
    : customHeader
      ? { [customHeader]: config.apiKey }
      : { Authorization: `Bearer ${config.apiKey}` };
  return { ...auth, ...(config.extraHeaders ?? {}) };
}

function usesModelsEndpoint(config: LLMConfig): boolean {
  return config.mode === "proxy" || config.provider === "custom";
}

/**
 * Checks a connection and lists its models. OpenAI-compatible endpoints
 * (proxy, custom) are asked for `GET <base>/models`; the direct providers list
 * their presets without a request, so their key is checked on the first message.
 */
export async function testConnection(config: LLMConfig): Promise<ConnectionTestResult> {
  const context = { mode: config.mode, provider: config.provider };
  if (!usesModelsEndpoint(config)) {
    return {
      ok: true,
      models: getPresetsForProvider(config.provider).map((preset) => preset.model),
      latencyMs: null,
      source: "presets",
    };
  }

  const base = toOpenAICompatibleBaseUrl(
    config.mode === "proxy" ? config.baseUrl || DEFAULT_PROXY_BASE_URL : (config.baseUrl ?? ""),
  );
  const timeout = createRequestTimeout();
  const started = performance.now();
  try {
    let response: Response;
    try {
      response = await fetch(`${base}/models`, {
        headers: requestHeaders(config),
        signal: timeout.signal,
      });
    } catch (error) {
      throw new LLMProviderError({
        ...context,
        status: null,
        detail: error instanceof Error ? error.message : String(error),
        timedOut: timeout.timedOut,
      });
    }
    if (!response.ok) {
      throw new LLMProviderError({
        ...context,
        status: response.status,
        detail: await response.text(),
      });
    }
    const models = parseModelList(await response.json());
    return {
      ok: true,
      models,
      latencyMs: Math.round(performance.now() - started),
      source: "endpoint",
    };
  } catch (error) {
    return { ok: false, error: toLLMError(error, context) };
  } finally {
    timeout.clear();
  }
}
