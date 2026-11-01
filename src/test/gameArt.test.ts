import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_BADGES } from '@/data/badges';
import { GLOVES } from '@/data/gloves';
import { ALL_POST_L100_BADGES } from '@/data/postL100Badges';

const missing = (folder: string, ids: string[]) =>
  ids.filter((id) => !existsSync(resolve(process.cwd(), 'public/art', folder, `${id}.webp`)));

describe('game art', () => {
  it('has an image for every glove', () => {
    expect(missing('gloves', Object.keys(GLOVES))).toEqual([]);
  });

  it('has an image for every badge', () => {
    expect(missing('badges', [...ALL_BADGES, ...ALL_POST_L100_BADGES].map((badge) => badge.id))).toEqual([]);
  });
});
