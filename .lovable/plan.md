
# Workout Log Improvements - Implementation Plan

## Summary
This plan addresses three related issues with the workout logging system:
1. Remove pre-baked mock workouts from the history store so new users start fresh
2. Add a "Complete Early" button on the workout session page that triggers the journal entry
3. Ensure the journal flow works correctly when workouts are completed

---

## What's Being Changed

### 1. Remove Mock Workouts
Currently, the workout history store initializes with 3 fake workouts (mock data) so every new user sees pre-filled entries. These will be removed so:
- New users see an empty workout log with "No History Yet" message
- Only actual completed workouts appear in the log
- Existing users who already have the mock data in their local storage will keep it (localStorage persists), but clearing storage or new installs will start fresh

### 2. Add "Complete Early" Button
A new button will be added next to the restart button in the workout session header that allows users to finish their workout at any point. When tapped:
- Workout immediately ends (no matter what segment they're on)
- The journal/notes screen appears (same one shown at natural completion)
- After logging, the workout is saved to history with actual elapsed time and XP earned

### 3. Journal Flow Verification
The journal entry screen already exists and works correctly when a workout finishes naturally. The same screen will be reused for early completion.

---

## Technical Details

### File Changes

**1. `src/stores/historyStore.ts`**
- Remove the `mockWorkouts` array (lines 13-55)
- Change initial state to empty array: `completedWorkouts: []`

**2. `src/pages/WorkoutSession.tsx`**
- Add a new "Complete Early" button (using a flag/checkmark icon) in the header near the restart button
- Add a new handler `handleCompleteEarly()` that:
  - Cancels any ongoing speech
  - Marks the workout as complete
  - Triggers the journal/completion screen
- The completion screen logic already handles logging to history via `handleLog()`

### UI Placement
The complete early button will be positioned:
- In the top-left header area, alongside the home and restart buttons
- Uses a checkmark icon to indicate "finish/done"
- Same styling as the restart button (rounded pill, surface background)

### Flow Diagram
```text
User clicks "Complete Early"
        |
        v
Set isComplete = true, isRunning = false
        |
        v
XP calculated based on totalElapsed time
        |
        v
Journal screen appears (notes + difficulty rating)
        |
        v
User clicks "Log Workout"
        |
        v
Workout saved to history store
        |
        v
User returns home or views logged entry
```

---

## Files to Modify
| File | Change |
|------|--------|
| `src/stores/historyStore.ts` | Remove mock workouts array, initialize with empty array |
| `src/pages/WorkoutSession.tsx` | Add "Complete Early" button and handler |

