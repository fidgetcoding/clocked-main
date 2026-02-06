

# Fix Level Display, XP Pacing, and Level-Up Celebration

## Three Issues to Fix

### 1. Level Labels Don't Update During Workout
**Root cause**: The `VerticalXPBar` in both `WorkoutSession` and `QuickSession` gets its level from `user?.currentLevel` in the local store. But XP is only committed to the store when the workout ends. So during the session, even if you earn enough XP to hit Level 2, the bar labels still show "Lvl 1" at the bottom and "Lvl 2" at the top.

**Fix**: Calculate the "live level" dynamically from `(user.totalXP + accumulatedXP)` using the existing `getLevelFromXP()` function, and pass that to `VerticalXPBar` instead of the stale store value. This way, the moment your accumulated XP crosses the threshold, the bar resets to empty, the bottom label updates to "Lvl 2", and the top shows "Lvl 3".

### 2. XP Pacing Feels Slow
The current formula for Beginner prestige: `XP for Level 1 = 1100 + (1 * 1.5) = 1102 XP`. At ~0.33 XP/sec for shadowboxing, that's ~56 minutes of pure active time to level up. For the very first level, this feels too long -- reaching Level 2 should feel achievable within a single workout session (~20-30 minutes of active work).

This is not a bug in the implementation -- the formula matches the documentation. However, the formula parameters may need a re-tuning. No changes will be made to the XP formula in this update unless you specifically request it. The level-up animation and proper bar behavior should make progression feel much better even at the current rate.

### 3. No Level-Up Celebration During Workout
Currently, the level-up sound only fires in the `addXP` store function, which runs at workout completion -- not during the live session when the bar visually fills. There's no visual celebration at all.

**Fix**: Add real-time level-up detection during the workout timer, triggering:
- A sound effect (the existing ascending arpeggio)
- A full-screen flash animation -- the volt/neon color floods the screen briefly
- A "LEVEL 2" (or whatever level) text animation that appears, holds, then fades
- Voice announcement: "Level Up! Level [number]!"

## Technical Details

### File: `src/pages/WorkoutSession.tsx`
- Add a `liveLevel` computed value: `getLevelFromXP(prestige, user.totalXP + accumulatedXP)`
- Add a `prevLevelRef` to track the last known level
- In the timer effect (or a separate effect watching `liveLevel`), detect when `liveLevel > prevLevelRef.current`
- On level-up: set a `levelUpAnimation` state with the new level number, play the sound, trigger voice
- Pass `liveLevel` instead of `user?.currentLevel` to `VerticalXPBar`
- Add a full-screen overlay component for the animation (absolutely positioned, z-50+)

### File: `src/pages/QuickSession.tsx`
- Same changes: compute `liveLevel` from accumulated XP, detect level-up, show animation
- Pass `liveLevel` to `VerticalXPBar`

### New Component: `src/components/ui/LevelUpOverlay.tsx`
A reusable full-screen celebration overlay:
- Takes `level` (number) and `onComplete` (callback when animation ends)
- On mount: screen flashes with the volt/neon color (opacity pulse from 0 to ~0.7 and back)
- Large "LEVEL [N]" text scales in from center with a glow effect
- Holds for ~1.5 seconds, then fades out
- Calls `onComplete` after ~2 seconds to clear the state
- Uses CSS keyframe animations (defined inline or in index.css)

### File: `src/index.css`
- Add keyframes for the level-up animation:
  - `@keyframes level-up-flash` -- volt color overlay that pulses in and fades
  - `@keyframes level-up-text` -- text scales up, holds, fades out

### File: `src/hooks/useSoundEffects.ts`
- No changes needed -- the existing `playLevelUpSound` function works; we just need to call it at the right time (during the session, not just at store commit)

### Behavior Flow
1. User is training, XP accumulates
2. `liveLevel` changes from 1 to 2
3. `LevelUpOverlay` appears with "LEVEL 2" text and volt flash
4. Level-up sound plays (ascending arpeggio)
5. Voice says "Level Up! Level 2!"
6. After ~2 seconds, overlay fades, timer continues
7. `VerticalXPBar` now shows "Lvl 2" at bottom, "Lvl 3" at top, bar reset near empty
