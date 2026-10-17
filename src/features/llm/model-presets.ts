import type { LLMConnection, LLMMode, LLMProvider } from "./types";

export interface ModelPreset {
  id: string;
  provider: LLMProvider;
  model: string;
  label: string;
  mode: LLMMode;
  deprecated?: boolean;
}

export const MODEL_PRESETS: Record<LLMProvider, ModelPreset[]> = {
  openai: [
    { id: "gpt-4o", provider: "openai", model: "gpt-4o", label: "GPT-4o", mode: "direct" },
    {
      id: "gpt-4o-mini",
      provider: "openai",
      model: "gpt-4o-mini",
      label: "GPT-4o mini",
      mode: "direct",
    },
    { id: "gpt-4.1", provider: "openai", model: "gpt-4.1", label: "GPT-4.1", mode: "direct" },
    {
      id: "gpt-4.1-mini",
      provider: "openai",
      model: "gpt-4.1-mini",
      label: "GPT-4.1 mini",
      mode: "direct",
    },
  ],
  anthropic: [
    {
      id: "claude-opus-5-5",
      provider: "anthropic",
      model: "claude-opus-5-5",
      label: "Claude Opus 5.5",
      mode: "direct",
    },
    {
      id: "claude-sonnet-5-5",
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      label: "Claude Sonnet 5.5",
      mode: "direct",
    },
    {
      id: "claude-haiku-5-5",
      provider: "anthropic",
      model: "claude-haiku-5-5",
      label: "Claude Haiku 5.5",
      mode: "direct",
    },
    {
      id: "claude-fable-5-1",
      provider: "anthropic",
      model: "claude-fable-5-1",
      label: "Claude Fable 5.1",
      mode: "direct",
    },
  ],
  custom: [],
};

export function getPresetsForProvider(provider: LLMProvider): ModelPreset[] {
  return MODEL_PRESETS[provider] ?? [];
}

/** What the model picker offers: the connection's tested models, else its presets, plus the current one. */
export function modelsForConnection(connection: LLMConnection): string[] {
  const listed =
    connection.models && connection.models.length > 0
      ? connection.models
      : getPresetsForProvider(connection.provider).map((preset) => preset.model);
  return listed.includes(connection.model) ? listed : [connection.model, ...listed];
}
