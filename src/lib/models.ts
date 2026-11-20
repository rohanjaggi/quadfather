export type AIProvider = "openai" | "anthropic" | "gemini" | "openrouter";

export interface AICredentials {
  provider: AIProvider;
  apiKey: string;
  /** null = the provider's default model. */
  model: string | null;
}

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
    { id: "gpt-6-luna", label: "GPT-6 Luna", description: "Cheapest" },
    { id: "gpt-6.1-terra", label: "GPT-6.1 Terra", description: "Smarter, still cheap" },
  ],
  anthropic: [
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", description: "Fast & affordable" },
  ],
  openrouter: [
    { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", description: "Fast & affordable" },
    { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", description: "Cheapest" },
    { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", description: "Most capable" },
    { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5", description: "Fast & affordable" },
    { id: "openai/gpt-6-luna", label: "GPT-6 Luna", description: "Cheapest" },
  ],
};

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: "gemini-3-flash-preview",
  openai: "gpt-6-luna",
  anthropic: "claude-haiku-5-5",
  openrouter: "google/gemini-3-flash-preview",
};

export function getModelForProvider(provider: AIProvider, userModel: string | null | undefined): string {
  if (userModel) return userModel;
  return DEFAULT_MODELS[provider];
}
