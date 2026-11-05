import { describe, expect, it } from 'vitest';
import { trustedAvatarUrl } from '@/lib/avatarUrl';

const project = 'https://abcd.supabase.co';
const stored = `${project}/storage/v1/object/public/avatars/user-1/avatar.png?t=1730000000000`;

describe('avatars from other people', () => {
  it('shows one stored in this app', () => {
    expect(trustedAvatarUrl(stored, project)).toBe(stored);
    expect(trustedAvatarUrl(stored, `${project}/`)).toBe(stored);
  });

  it('hides one pointing anywhere else, so viewing a profile cannot leak your IP', () => {
    for (const url of [
      'https://evil.tld/p.gif',
      'https://evil.tld/storage/v1/object/public/avatars/user-1/a.png',
      `${project}.evil.tld/storage/v1/object/public/avatars/a.png`,
      `${project}/storage/v1/object/public/other-bucket/a.png`,
      'javascript:alert(1)',
      'data:image/svg+xml,<svg/>',
      'not a url',
    ]) expect(trustedAvatarUrl(url, project)).toBeNull();
  });

  it('shows nothing without a backend or an avatar', () => {
    expect(trustedAvatarUrl(stored, undefined)).toBeNull();
    expect(trustedAvatarUrl(null, project)).toBeNull();
  });
});
