import { createClient } from '@supabase/supabase-js';
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
      },
    })
  : createOfflineClient();
