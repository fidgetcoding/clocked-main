type GetEnv = (name: string) => string | undefined;

// Hosted functions receive the new keys as JSON dictionaries. The legacy single-value keys are
// being retired, so they're only the fallback.
function fromDictionary(getEnv: GetEnv, name: string): string | undefined {
  const raw = getEnv(name);
  if (!raw) return undefined;
  try {
    const key = JSON.parse(raw)?.default;
    return typeof key === 'string' && key ? key : undefined;
  } catch {
    return undefined;
  }
}

export function resolvePublicKey(getEnv: GetEnv): string | undefined {
  return fromDictionary(getEnv, 'SUPABASE_PUBLISHABLE_KEYS') ?? getEnv('SUPABASE_ANON_KEY');
}

export function resolveServiceKey(getEnv: GetEnv): string | undefined {
  return fromDictionary(getEnv, 'SUPABASE_SECRET_KEYS') ?? getEnv('SUPABASE_SERVICE_ROLE_KEY');
}
