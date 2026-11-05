// Avatars are shown only from this app's own avatar storage. avatar_url is a plain column its owner can
// set to anything, and an outside address would let them log the IP of everyone who sees their face.

const STORAGE_URL = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');

/** The avatar if it lives in this project's avatars bucket, otherwise null (the plain placeholder shows). */
export function trustedAvatarUrl(url: string | null | undefined, storageUrl: string | undefined = STORAGE_URL): string | null {
  if (!url || !storageUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const expected = new URL(storageUrl);
  return parsed.origin === expected.origin && parsed.pathname.startsWith('/storage/v1/object/public/avatars/') ? parsed.href : null;
}
