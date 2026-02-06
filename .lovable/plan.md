
# Consolidate Sound Settings - Remove Unused Toggles

## Summary
Merge Voice Alerts into a single "Sound Alerts" section, keep only working/wanted features, and remove all haptic toggles.

---

## Final Structure

**Sound Alerts** (single card)
| Toggle | Description | Status |
|--------|-------------|--------|
| Voice Announcements | Announce segment changes and instructions | Keep |
| Countdown Voice | 3-second countdown before segment ends | Keep |
| Combo Callouts | Call out punch combinations during combos | Keep |
| 10-Second Warning | Warning beep at 10 seconds remaining | Keep |

**Removed:**
- ❌ Sound Effects master toggle (not needed, individual toggles control)
- ❌ Round Start Bell (not implemented/wanted)
- ❌ Round End Bell (not implemented/wanted)
- ❌ Segment Transition Beep (not implemented/wanted)
- ❌ Entire Haptic Feedback section (not implemented/wanted)

---

## Changes

### File: `src/pages/Settings.tsx`

1. **Combine `voiceAlerts` and `soundAlerts` arrays** into a single `soundAlerts` array with only the 4 desired toggles

2. **Remove the Voice Alerts card** (lines 167-182)

3. **Update the Sound Alerts card** to show the merged toggles with updated header description

4. **Remove the Haptic Feedback card** (lines 201-216)

5. **Remove unused imports** (Vibrate icon no longer needed)

---

## Code Changes Preview

```typescript
// New combined soundAlerts array:
const soundAlerts = [
  { 
    key: 'voiceAnnouncements', 
    label: 'Voice Announcements', 
    description: 'Announce segment changes and instructions',
    icon: Volume2,
  },
  { 
    key: 'voiceCountdown', 
    label: 'Countdown Voice', 
    description: '3-second countdown before segment ends',
    icon: Timer,
  },
  { 
    key: 'voiceComboCallouts', 
    label: 'Combo Callouts', 
    description: 'Call out punch combinations during combos',
    icon: Volume2,
  },
  { 
    key: 'tenSecondWarning', 
    label: '10-Second Warning', 
    description: 'Warning beep at 10 seconds remaining',
    icon: Timer,
  },
];
```

---

## Cleanup

### File: `src/hooks/useSoundEffects.ts`
- Keep `playWarningBeep` (used for 10-second warning)
- Remove `playBellSound` and `playTransitionBeep` (no longer needed)

### File: `src/hooks/useHaptics.ts`
- Can be removed entirely or kept for future use (no harm keeping it)

### File: `src/pages/WorkoutSession.tsx`
- Remove calls to `playBellSound` and `playTransitionBeep`
- Remove haptic feedback calls
- Keep `playWarningBeep` for the 10-second warning

---

## Files Modified

| File | Action |
|------|--------|
| `src/pages/Settings.tsx` | Merge sections, remove haptics, remove unused toggles |
| `src/hooks/useSoundEffects.ts` | Remove unused bell/transition functions |
| `src/pages/WorkoutSession.tsx` | Remove unused sound/haptic calls |
