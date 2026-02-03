
# Fix: Infinite Loop on Workout Completion

## Problem

When the workout timer reaches zero on the last phase, an infinite loop error ("Maximum update depth exceeded") crashes the app instead of showing the workout complete screen. The error originates from line 259 in `WorkoutSession.tsx`.

## Root Cause

There are multiple issues causing this infinite loop:

1. **Effect dependency chain**: When `isComplete` becomes true, the XP-awarding effect runs and calls `addXP()`. This updates the Zustand store, which triggers a re-render because the component subscribes to `user` state. On re-render, if the ref guard fails or timing issues occur, the effect can fire again.

2. **Competing effects**: The segment transition effect (lines 238-256) sets `isComplete = true` when the timer hits zero. This triggers the XP effect. But both effects are reacting to state changes in a way that can cascade.

3. **Missing state isolation**: The `xpAwardedRef` guard should prevent multiple executions, but refs can have timing issues with React's rendering cycle, especially in strict mode or with rapid state updates.

## Solution

I'll implement a more robust fix with these changes:

### 1. Consolidate completion logic
Move the XP awarding into the same effect that sets `isComplete`, so it happens atomically in one place rather than as a reaction to state changes.

### 2. Add state flag instead of ref
Use a state flag `hasAwardedXP` in addition to the ref, since state updates are synchronized with React's render cycle.

### 3. Wrap async operations in try-catch
Add error handling to prevent unhandled exceptions from crashing the app.

## Code Changes

**File: `src/pages/WorkoutSession.tsx`**

**Change 1**: Add a state flag for XP awarding (around line 139)
```typescript
const [hasAwardedXP, setHasAwardedXP] = useState(false);
```

**Change 2**: Modify the segment transition effect (lines 238-256) to award XP atomically when workout completes:
```typescript
useEffect(() => {
  if (timeRemaining <= 0 && isRunning) {
    if (isPreparation) {
      setIsPreparation(false);
      setTimeRemaining(flatSegments[0]?.duration || 60);
    } else if (currentSegmentIndex < flatSegments.length - 1) {
      setCurrentSegmentIndex((prev) => prev + 1);
      setTimeRemaining(flatSegments[currentSegmentIndex + 1]?.duration || 60);
    } else if (!isComplete) {
      // Workout complete - award XP and transition in one atomic update
      cancelSpeech();
      setIsComplete(true);
      setIsRunning(false);
      
      // Award XP immediately here, not in a separate effect
      if (!xpAwardedRef.current) {
        xpAwardedRef.current = true;
        setHasAwardedXP(true);
        const xpEarned = Math.floor((totalElapsed / 60) * 10);
        try {
          useUserStore.getState().addXP(xpEarned, true);
        } catch (error) {
          console.error('Failed to award XP:', error);
        }
      }
      
      if (workout) {
        markWorkoutUsed(workout.id);
      }
    }
  }
}, [timeRemaining, isRunning, isPreparation, currentSegmentIndex, flatSegments, workout, markWorkoutUsed, cancelSpeech, isComplete, totalElapsed]);
```

**Change 3**: Remove the separate XP-awarding effect entirely (delete lines 258-269):
```typescript
// DELETE THIS ENTIRE EFFECT:
// const xpAwardedRef = useRef(false);
// useEffect(() => {
//   if (isComplete && totalElapsed > 0 && !xpAwardedRef.current) {
//     ...
//   }
// }, [isComplete, totalElapsed]);
```

**Change 4**: Keep the `xpAwardedRef` declaration but move it earlier with other refs (around line 186):
```typescript
const prevSegmentIndexRef = useRef<number>(-1);
const xpAwardedRef = useRef(false);  // Move here
```

**Change 5**: Update `handleCompleteEarly` function (lines 333-343) to also award XP atomically:
```typescript
const handleCompleteEarly = () => {
  cancelSpeech();
  setIsComplete(true);
  setIsRunning(false);
  
  // Award XP immediately
  if (!xpAwardedRef.current) {
    xpAwardedRef.current = true;
    setHasAwardedXP(true);
    const xpEarned = Math.floor((totalElapsed / 60) * 10);
    try {
      useUserStore.getState().addXP(xpEarned, true);
    } catch (error) {
      console.error('Failed to award XP:', error);
    }
  }
  
  if (workout) {
    markWorkoutUsed(workout.id);
  }
};
```

**Change 6**: Update `handleReset` to reset the XP awarded flag (around line 297-305):
```typescript
const handleReset = () => {
  setCurrentSegmentIndex(0);
  setTimeRemaining(10);
  setTotalElapsed(0);
  setIsRunning(false);
  setIsPaused(true);
  setIsPreparation(true);
  setIsComplete(false);
  setHasAwardedXP(false);  // Add this
  xpAwardedRef.current = false;  // Reset the ref too
};
```

## Technical Details

| Issue | Solution |
|-------|----------|
| XP effect triggering re-renders | Move XP awarding into completion effect |
| Ref timing issues | Add state flag as backup |
| Unhandled async errors | Wrap in try-catch |
| Cascading state updates | Consolidate into single effect |

## Testing

After this fix:
1. Start a workout and let it run to the last segment
2. Wait for the timer to reach zero
3. The workout complete screen should appear without errors
4. XP should be awarded once
5. Test "Complete Early" button - should also work without errors
