import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStance } from '@/hooks/useStance';

const mocks = vi.hoisted(() => ({ profile: null as null | { preferences: Record<string, unknown> }, mutate: vi.fn() }));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ profile: mocks.profile, updateProfile: { mutate: mocks.mutate } }),
}));

describe('useStance', () => {
  beforeEach(() => {
    mocks.mutate.mockClear();
    mocks.profile = { preferences: { voiceType: 'system', soundEnabled: true, voiceAnnouncements: true } };
  });

  it('defaults an existing user with no stance to orthodox, and says they have not chosen', () => {
    const { result } = renderHook(() => useStance());
    expect(result.current.stance).toBe('orthodox');
    expect(result.current.hasChosen).toBe(false);
  });

  it('defaults while the profile is still loading', () => {
    mocks.profile = null;
    expect(renderHook(() => useStance()).result.current.stance).toBe('orthodox');
  });

  it('reads a saved stance', () => {
    mocks.profile = { preferences: { stance: 'southpaw' } };
    const { result } = renderHook(() => useStance());
    expect(result.current.stance).toBe('southpaw');
    expect(result.current.hasChosen).toBe(true);
  });

  it('ignores a value it does not know', () => {
    mocks.profile = { preferences: { stance: 'sideways' } };
    const { result } = renderHook(() => useStance());
    expect(result.current.stance).toBe('orthodox');
    expect(result.current.hasChosen).toBe(false);
  });

  it('saves into the preferences JSON without losing what is already there', () => {
    const { result } = renderHook(() => useStance());
    result.current.setStance('southpaw');
    expect(mocks.mutate).toHaveBeenCalledWith({
      preferences: { voiceType: 'system', soundEnabled: true, voiceAnnouncements: true, stance: 'southpaw' },
    });
  });
});
