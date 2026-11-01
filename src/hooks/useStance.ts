import { useCallback } from 'react';
import { useProfile } from '@/hooks/useProfile';
import type { Stance } from '@/lib/punch/types';

export const STANCE_OPTIONS: { value: Stance; label: string; hint: string }[] = [
  { value: 'orthodox', label: 'Orthodox', hint: 'Left hand leads' },
  { value: 'southpaw', label: 'Southpaw', hint: 'Right hand leads' },
];

/** The fighter's stance, kept in profile.preferences for guests and accounts alike. */
export function useStance() {
  const { profile, updateProfile } = useProfile();
  const preferences = profile?.preferences;
  const saved = preferences?.stance;
  const hasChosen = saved === 'orthodox' || saved === 'southpaw';

  const { mutate } = updateProfile;
  const setStance = useCallback(
    (stance: Stance) => mutate({ preferences: { ...preferences, stance } as NonNullable<typeof preferences> }),
    [mutate, preferences],
  );

  return { stance: (hasChosen ? saved : 'orthodox') as Stance, hasChosen, setStance };
}
