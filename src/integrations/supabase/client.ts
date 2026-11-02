import { createClient } from '@supabase/supabase-js';
import { navigatorLock, NavigatorLockAcquireTimeoutError, type LockFunc } from '@supabase/auth-js';
import type { Database } from './types';
import { createOfflineClient } from './offlineClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

function isValidUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Supabase's own cross-tab lock, except for the background refresh that only wants the lock if it's free.
 * Supabase throws from inside the lock request when it isn't, and Firefox reports that as an uncaught
 * error on every page. Here the refusal is thrown after the request has finished instead.
 */
const crossTabLock: LockFunc = async (name, acquireTimeout, fn) => {
  const locks = globalThis.navigator?.locks;
  if (acquireTimeout !== 0 || !locks) return navigatorLock(name, acquireTimeout, fn);
  let acquired = false;
  const result = await locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
    if (!lock) return undefined;
    acquired = true;
    return fn();
  });
  if (!acquired) {
    throw new NavigatorLockAcquireTimeoutError(`Acquiring an exclusive Navigator LockManager lock "${name}" immediately failed`);
  }
  return result as Awaited<ReturnType<typeof fn>>;
};

/** False when this copy has no Supabase project: the app runs in guest mode with no network. */
export const isBackendConfigured = isValidUrl(SUPABASE_URL) && !!SUPABASE_PUBLISHABLE_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = isBackendConfigured
  ? createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
        lock: crossTabLock,
      },
    })
  : createOfflineClient();
