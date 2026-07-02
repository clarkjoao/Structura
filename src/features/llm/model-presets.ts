import type { LLMMode, LLMProvider } from "./types";

export interface ModelPreset {
  id: string;
  provider: LLMProvider;
  model: string;
  label: string;
  mode: LLMMode;
}

export const MODEL_PRESETS: ModelPreset[] = [
  { id: "gpt-4o", provider: "openai", model: "gpt-4o", label: "GPT-4o", mode: "direct" },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    model: "gpt-4o-mini",
    label: "GPT-4o mini",
    mode: "direct",
  },
  { id: "o3-mini", provider: "openai", model: "o3-mini", label: "o3-mini", mode: "direct" },
  {
    id: "claude-sonnet",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    mode: "direct",
  },
  {
    id: "claude-haiku",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    mode: "direct",
  },
];
