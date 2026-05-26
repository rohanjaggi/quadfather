export type AIProvider = "openai" | "anthropic" | "gemini" | "openrouter";

export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export const PROVIDER_MODELS: Record<AIProvider, ModelOption[]> = {
  gemini: [
    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", description: "Fast & affordable" },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", description: "Cheapest" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", description: "Most capable" },
  ],
  openai: [
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", description: "Fast & affordable" },
    { id: "gpt-5.5", label: "GPT-5.5", description: "Most capable" },
  ],
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Claude 4.5 Haiku", description: "Fast & affordable" },
    { id: "claude-sonnet-4-6-20260320", label: "Claude 4.6 Sonnet", description: "Best balance" },
  ],
  openrouter: [
    { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", description: "Fast & affordable" },
    { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", description: "Cheapest" },
    { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", description: "Most capable" },
    { id: "anthropic/claude-haiku-4-5-20251001", label: "Claude 4.5 Haiku", description: "Fast & affordable" },
    { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini", description: "Fast & affordable" },
  ],
};

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: "gemini-3-flash-preview",
  openai: "gpt-5.4-mini",
  anthropic: "claude-haiku-4-5-20251001",
  openrouter: "google/gemini-3-flash-preview",
};

export function getModelForProvider(provider: AIProvider, userModel: string | null | undefined): string {
  if (userModel) return userModel;
  return DEFAULT_MODELS[provider];
}
