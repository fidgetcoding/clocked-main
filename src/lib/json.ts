import type { Json } from '@/integrations/supabase/types';

// Saved shapes are plain JSON, but interfaces can't prove that to the compiler. These mark the
// spot where a typed value crosses into or out of a JSON column.
export const toJson = (value: unknown): Json => value as Json;
export const fromJson = <T>(value: Json): T => value as unknown as T;
