
# Fix Settings Sound/Haptic Toggles - Accuracy & Implementation

## Problem Summary
The Settings page shows toggles for sound and haptic features that either:
1. Have **incorrect descriptions** (e.g., "10-second countdown" when it's actually 3 seconds)
2. **Don't do anything** (bells, beeps, haptics are not implemented)

---

## Part 1: Fix Inaccurate Labels

### Voice Alerts Section

**File: `src/pages/Settings.tsx`**

| Current | Should Be |
|---------|-----------|
| `Countdown Voice` - "10-second countdown before segment ends" | `Countdown Voice` - "3-second countdown before segment ends" |

### Sound Alerts Section

| Current | Should Be |
|---------|-----------|
| `Sound Effects` - "Boxing bell and timer sounds" | `Sound Effects` - "XP and level-up sounds" |
| `10-Second Warning` - "Warning beep at 10 seconds remaining" | Keep this but implement the beep |

---

## Part 2: Implement Missing Sound Effects

**File: `src/hooks/useSoundEffects.ts`**

Add new sound functions:

```typescript
// Boxing bell (traditional ring bell)
playBellSound: () => {
  // Synthesize a bell-like tone with harmonics
  // Frequency ~800Hz with overtones, quick attack, medium decay
}

// Warning beep (distinct alert)
playWarningBeep: () => {
  // Two short beeps at ~1000Hz
}

// Transition beep (subtle click/blip)
playTransitionBeep: () => {
  // Single short blip, softer than warning
}
```

**File: `src/pages/WorkoutSession.tsx`**

Wire up the sounds to the correct events:

1. **Round Start Bell**: Play when entering a "grind" phase work segment
2. **Round End Bell**: Play when a work segment ends (before rest)
3. **10-Second Warning Beep**: At `timeRemaining === 10` for active segments
4. **Segment Transition Beep**: On segment index change

Each sound check respects the individual toggle AND the master `soundEnabled` toggle.

---

## Part 3: Implement Haptic Feedback

**File: `src/hooks/useHaptics.ts`** (NEW)

```typescript
export const useHaptics = () => {
  const hapticEnabled = user?.preferences?.hapticEnabled ?? true;

  const vibrateShort = () => {
    if (hapticEnabled && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const vibrateMedium = () => {
    if (hapticEnabled && navigator.vibrate) {
      navigator.vibrate([50, 50, 100]);
    }
  };

  const vibrateWarning = () => {
    if (hapticEnabled && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  return { vibrateShort, vibrateMedium, vibrateWarning };
};
```

**File: `src/pages/WorkoutSession.tsx`**

Wire haptics:
- `hapticRoundChange`: Vibrate on segment transition (rest ↔ work)
- `hapticWarning`: Vibrate at 10 seconds remaining

---

## Part 4: Clean Up or Remove Dead Toggles

**Option A (Recommended)**: Implement all the features as described above.

**Option B**: Remove toggles that aren't implemented and add them back when ready:
- Remove `roundStartBell`, `roundEndBell`, `tenSecondWarning`, `segmentTransitionBeep`
- Remove all haptic toggles
- Keep only working voice toggles and the XP sound toggle

---

## Implementation Priority

1. **Quick win - Fix labels** (5 min)
   - Change "10-second countdown" → "3-second countdown"
   - Change "Boxing bell and timer sounds" → "XP and level-up sounds"

2. **Implement bells and beeps** (30 min)
   - Add bell, beep functions to `useSoundEffects.ts`
   - Wire them in `WorkoutSession.tsx`

3. **Implement haptics** (15 min)
   - Create `useHaptics.ts` hook
   - Wire in `WorkoutSession.tsx`

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Settings.tsx` | Fix descriptions for countdown voice and sound effects |
| `src/hooks/useSoundEffects.ts` | Add `playBellSound`, `playWarningBeep`, `playTransitionBeep` |
| `src/hooks/useHaptics.ts` | New file - haptic feedback utilities |
| `src/pages/WorkoutSession.tsx` | Wire up all sounds and haptics to correct events |

---

## Summary Table

| Feature | Current State | After Fix |
|---------|--------------|-----------|
| Voice countdown label | "10-second" (wrong) | "3-second" (accurate) |
| Sound Effects description | "bells and timer" (wrong) | "XP and level-up" (accurate) |
| Round Start Bell | Not implemented | ✅ Bell sound plays |
| Round End Bell | Not implemented | ✅ Bell sound plays |
| 10-Second Warning Beep | Not implemented | ✅ Beep plays |
| Segment Transition Beep | Not implemented | ✅ Beep plays |
| All Haptic toggles | Not implemented | ✅ Vibration works |
