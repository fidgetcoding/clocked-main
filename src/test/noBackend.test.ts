import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.hoisted(() => vi.fn(() => ({ real: true })));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
});

async function loadClient(url: string | undefined, key: string | undefined) {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', url as string);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key as string);
  return import('@/integrations/supabase/client');
}

beforeEach(() => createClient.mockClear());
afterEach(() => vi.unstubAllEnvs());

describe('supabase client selection', () => {
  it.each([
    ['both empty', '', ''],
    ['no key', 'http://127.0.0.1:54321', ''],
    ['no url', '', 'key'],
    ['blank url', '   ', 'key'],
    ['a malformed url', 'not a url', 'key'],
  ])('never calls createClient with %s', async (_label, url, key) => {
    const { isBackendConfigured } = await loadClient(url, key);
    expect(isBackendConfigured).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('never calls createClient when the variables are not set at all', async () => {
    vi.resetModules();
    const { isBackendConfigured } = await import('@/integrations/supabase/client');
    expect(isBackendConfigured).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('uses the real client when both are set', async () => {
    const { isBackendConfigured, supabase } = await loadClient('http://127.0.0.1:54321', 'key');
    expect(isBackendConfigured).toBe(true);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0].slice(0, 2)).toEqual(['http://127.0.0.1:54321', 'key']);
    expect(supabase).toEqual({ real: true });
  });
});

// The real client's types only allow known tables, and these calls don't care which table it is
type QueryResult = { data: unknown; error: { message: string } | null };
interface LooseQuery extends PromiseLike<QueryResult> {
  select(columns?: string): LooseQuery;
  insert(row: object): LooseQuery;
  update(row: object): LooseQuery;
  upsert(row: object): LooseQuery;
  delete(): LooseQuery;
  eq(column: string, value: unknown): LooseQuery;
  order(column: string): LooseQuery;
  limit(count: number): LooseQuery;
  single(): LooseQuery;
  maybeSingle(): LooseQuery;
}
interface LooseClient {
  auth: SupabaseClient['auth'];
  from(table: string): LooseQuery;
  rpc(name: string, args: object): LooseQuery;
  functions: { invoke(name: string): Promise<QueryResult> };
}

describe('offline client', () => {
  const offline = async () => {
    const { createOfflineClient } = await import('@/integrations/supabase/offlineClient');
    return createOfflineClient() as unknown as LooseClient;
  };

  it('reports no session and fires the initial auth event', async () => {
    const client = await offline();
    expect((await client.auth.getSession()).data.session).toBeNull();
    expect((await client.auth.getUser()).data.user).toBeNull();
    const event = await new Promise((resolve) => client.auth.onAuthStateChange(resolve));
    expect(event).toBe('INITIAL_SESSION');
  });

  it('returns empty reads through any query chain', async () => {
    const client = await offline();
    const list = await client.from('clubs').select('*').eq('a', 1).order('b').limit(2);
    expect(list).toMatchObject({ data: [], error: null });
    expect(await client.from('profiles').select('*').eq('a', 1).maybeSingle()).toMatchObject({ data: null, error: null });
    expect(await client.rpc('anything', {})).toMatchObject({ data: [], error: null });
  });

  it('fails writes instead of pretending they saved', async () => {
    const client = await offline();
    for (const write of [
      client.from('workouts').insert({}).select().single(),
      client.from('workouts').update({}).eq('id', 1),
      client.from('workouts').upsert({}),
      client.from('workouts').delete().eq('id', 1),
    ]) {
      expect((await write).error?.message).toBe('No backend is configured');
    }
    expect((await client.auth.signInWithOtp({ email: 'a@b.c' })).error?.message).toBe('No backend is configured');
    expect((await client.functions.invoke('generate-workout')).error?.message).toBe('No backend is configured');
  });
});
