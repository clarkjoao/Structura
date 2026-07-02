export type LLMErrorKind =
  "auth" | "rate_limit" | "cors" | "network" | "model" | "server" | "timeout" | "unknown";

export class LLMProviderError extends Error {
  constructor(
    public readonly status: number | null,
    public readonly provider: string,
    public readonly rawMessage: string,
  ) {
    super(rawMessage);
    this.name = "LLMProviderError";
  }

  get kind(): LLMErrorKind {
    const normalizedMessage = this.message.toLowerCase();
    if (normalizedMessage.includes("timeout")) {
      return "timeout";
    }
    if (normalizedMessage.includes("cors") || normalizedMessage.includes("blocked")) {
      return "cors";
    }
    if (this.status === 401) {
      return "auth";
    }
    if (this.status === 429) {
      return "rate_limit";
    }
    if (this.status === 404) {
      return "model";
    }
    if (this.status != null && this.status >= 500) {
      return "server";
    }
    if (this.status === null) {
      return "network";
    }
    return "unknown";
  }
}

export function getLLMErrorI18nKey(kind: LLMErrorKind): string {
  return `llmChat.error.${kind}`;
}
