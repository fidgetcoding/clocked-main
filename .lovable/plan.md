
# Plan: Fix Workout Auto-Completion When Last Segment Timer Ends

## Problem
When the timer reaches 0 on the last segment of a workout (e.g., the 10-minute Treadmill in Beginner Boxing I), the "Workout Complete" screen does not appear. Users must manually click the "Complete Early" button to see the completion screen.

## Root Cause
The segment transition logic checks `timeRemaining === 0` exactly, which is fragile because:
1. **Race condition**: The interval may tick past 0 to -1 before the effect processes
2. **React batching**: Multiple state updates may not trigger the effect in the expected order
3. **Missing cleanup**: The natural completion path doesn't cancel speech synthesis (unlike early completion)

## Solution

### File: `src/pages/WorkoutSession.tsx`

**Change 1: Make the timer check more robust (line 239)**

Change from:
```typescript
if (timeRemaining === 0 && isRunning) {
```

To:
```typescript
if (timeRemaining <= 0 && isRunning) {
```

This ensures the completion triggers even if the timer decrements past 0.

**Change 2: Cancel speech synthesis on natural completion (around line 247)**

Add `cancelSpeech()` call when workout completes naturally, matching the behavior of `handleCompleteEarly`:

```typescript
} else {
  // Workout complete - cancel any ongoing speech
  cancelSpeech();
  setIsComplete(true);
  setIsRunning(false);
  if (workout) {
    markWorkoutUsed(workout.id);
  }
}
```

**Change 3: Add `cancelSpeech` to the effect's dependencies (line 255)**

Update the dependency array to include `cancelSpeech`:
```typescript
}, [timeRemaining, isRunning, isPreparation, currentSegmentIndex, flatSegments, workout, markWorkoutUsed, cancelSpeech]);
```

## Expected Behavior After Fix

1. User starts "Beginner Boxing I" workout
2. Timer progresses through all segments (warmup, grind cycles, cooldown)
3. When the final segment (Treadmill - 10 min) timer hits 0:
   - Any ongoing voice announcement stops
   - `isComplete` is set to `true`
   - The "Workout Complete" screen appears
   - Duration shows the actual elapsed time
   - XP earned shows the calculated value based on duration

## Technical Details

- The fix uses `<= 0` instead of `=== 0` to handle edge cases where the interval fires faster than React processes effects
- Adding `cancelSpeech()` ensures voice announcements don't continue playing after workout ends
- This matches the existing behavior of the "Complete Early" button for consistency
