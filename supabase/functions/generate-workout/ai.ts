export const DEFAULT_AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const DEFAULT_AI_MODEL = 'gemini-3.8-flash';
// Answer before the platform cuts the request off, so the app gets a fallback instead of a gateway error
export const DEFAULT_AI_TIMEOUT_MS = 90_000;

export interface AiConfig {
  apiKey: string;
  chatCompletionsUrl: string;
  model: string;
  timeoutMs: number;
}

// Works with any OpenAI-compatible provider. Returns null without a key, which the function
// answers with a 503 so the app falls back to its on-device parser.
export function resolveAiConfig(getEnv: (name: string) => string | undefined): AiConfig | null {
  const apiKey = getEnv('AI_API_KEY')?.trim();
  if (!apiKey) return null;

  const baseUrl = getEnv('AI_BASE_URL')?.trim() || DEFAULT_AI_BASE_URL;
  return {
    apiKey,
    chatCompletionsUrl: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
    model: getEnv('AI_MODEL')?.trim() || DEFAULT_AI_MODEL,
    timeoutMs: Number(getEnv('AI_TIMEOUT_MS')) || DEFAULT_AI_TIMEOUT_MS,
  };
}
