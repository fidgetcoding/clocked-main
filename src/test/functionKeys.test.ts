import { describe, expect, it } from 'vitest';
import { resolvePublicKey, resolveServiceKey } from '../../supabase/functions/_shared/keys';

const fromEnv = (env: Record<string, string>) => (name: string) => env[name];

describe('edge function key resolution', () => {
  it('prefers the new key dictionaries', () => {
    const env = fromEnv({
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'sb_publishable_x' }),
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_x' }),
      SUPABASE_ANON_KEY: 'legacy-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-service',
    });
    expect(resolvePublicKey(env)).toBe('sb_publishable_x');
    expect(resolveServiceKey(env)).toBe('sb_secret_x');
  });

  it('falls back to the legacy keys', () => {
    const env = fromEnv({ SUPABASE_ANON_KEY: 'legacy-anon', SUPABASE_SERVICE_ROLE_KEY: 'legacy-service' });
    expect(resolvePublicKey(env)).toBe('legacy-anon');
    expect(resolveServiceKey(env)).toBe('legacy-service');
  });

  it('survives a malformed or empty dictionary', () => {
    const env = fromEnv({ SUPABASE_PUBLISHABLE_KEYS: 'not json', SUPABASE_SECRET_KEYS: '{}', SUPABASE_ANON_KEY: 'legacy-anon' });
    expect(resolvePublicKey(env)).toBe('legacy-anon');
    expect(resolveServiceKey(env)).toBeUndefined();
  });
});
