import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  resolveAiConfig,
} from '../../supabase/functions/generate-workout/ai';

const fromEnv = (env: Record<string, string>) => (name: string) => env[name];

describe('resolveAiConfig', () => {
  it.each([
    ['missing', {}],
    ['empty', { AI_API_KEY: '' }],
    ['blank', { AI_API_KEY: '   ' }],
  ])('returns null when the key is %s', (_label, env) => {
    expect(resolveAiConfig(fromEnv(env))).toBeNull();
  });

  it('uses the defaults when only a key is set', () => {
    expect(resolveAiConfig(fromEnv({ AI_API_KEY: 'k' }))).toEqual({
      apiKey: 'k',
      chatCompletionsUrl: `${DEFAULT_AI_BASE_URL}/chat/completions`,
      model: DEFAULT_AI_MODEL,
    });
  });

  it('honours a custom provider and tolerates a trailing slash', () => {
    const config = resolveAiConfig(fromEnv({ AI_API_KEY: 'k', AI_BASE_URL: 'https://llm.example/v1/', AI_MODEL: 'm' }));
    expect(config?.chatCompletionsUrl).toBe('https://llm.example/v1/chat/completions');
    expect(config?.model).toBe('m');
  });
});
