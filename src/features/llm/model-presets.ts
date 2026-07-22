import type { LLMMode, LLMProvider } from "./types";

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
      id: "claude-sonnet-4-5",
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      label: "Claude Sonnet 4.5",
      mode: "direct",
    },
    {
      id: "claude-haiku-4-5",
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      label: "Claude Haiku 4.5",
      mode: "direct",
    },
    {
      id: "claude-sonnet-5",
      provider: "anthropic",
      model: "claude-sonnet-5",
      label: "Claude Sonnet 5",
      mode: "direct",
    },
    {
      id: "claude-opus-4-8",
      provider: "anthropic",
      model: "claude-opus-4-8",
      label: "Claude Opus 4.8",
      mode: "direct",
    },
  ],
  custom: [],
};

export function getPresetsForProvider(provider: LLMProvider): ModelPreset[] {
  return MODEL_PRESETS[provider] ?? [];
}
