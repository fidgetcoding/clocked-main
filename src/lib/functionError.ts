/**
 * The reason an edge function gave. supabase-js reports any non-2xx as "Edge Function returned a
 * non-2xx status code" and keeps the real answer on the response it attaches as `context`.
 */
export async function functionErrorMessage(error: { message?: string; context?: unknown }): Promise<string> {
  const response = error.context;
  if (response instanceof Response) {
    try {
      const body = await response.clone().json();
      if (typeof body?.error === 'string' && body.error) return body.error;
    } catch {
      // Not JSON, so there's nothing better than the generic message
    }
  }
  return error.message || 'Something went wrong';
}
