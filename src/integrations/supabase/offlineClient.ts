import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const NO_BACKEND = 'No backend is configured';
const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);
const SINGLE_ROW_METHODS = new Set(['single', 'maybeSingle']);

type QueryResult = { data: unknown; error: { message: string } | null; count: number | null };

// Stands in for a PostgREST query: every chained call returns the builder, and awaiting it
// settles. Reads come back empty so the UI renders; writes fail so nothing claims it saved.
function queryBuilder(result: QueryResult = { data: [], error: null, count: 0 }): unknown {
  return new Proxy(() => {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject);
      }
      if (typeof prop !== 'string') return undefined;
      if (WRITE_METHODS.has(prop)) {
        return () => queryBuilder({ data: null, error: { message: NO_BACKEND }, count: null });
      }
      if (SINGLE_ROW_METHODS.has(prop)) {
        return () => queryBuilder({ ...result, data: null });
      }
      return () => queryBuilder(result);
    },
  });
}

/**
 * What the app talks to when no Supabase project is configured. It has the parts of the client
 * the app uses, makes no network calls, and always reports that nobody is signed in, which puts
 * every hook in guest mode.
 */
export function createOfflineClient() {
  const noBackendError = { message: NO_BACKEND, status: 503 };

  const client = {
    from: () => queryBuilder(),
    rpc: () => queryBuilder(),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: (callback: (event: string, session: null) => void) => {
        setTimeout(() => callback('INITIAL_SESSION', null), 0);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithOtp: async () => ({ data: { user: null, session: null }, error: noBackendError }),
      signOut: async () => ({ error: null }),
    },
    functions: {
      invoke: async () => ({ data: null, error: noBackendError }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: noBackendError }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  };

  return client as unknown as SupabaseClient<Database>;
}
