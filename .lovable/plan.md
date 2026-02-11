

# Fix Workout Count and Day Streak Tracking

## Problem

1. **Workouts count shows 0** -- the increment code was added after the first workout was logged, so it was never counted. Also, there's no reconciliation between `workout_history` (the actual log) and `profiles.workouts_completed`.
2. **Streak always shows 0** -- the `incrementStreak` mutation exists in `useProfile` but is never called from either session page. There is also no logic to check whether workouts were done on consecutive days, and `last_workout_date` is never set.

## Solution

### 1. Make workouts_completed derive from actual history count

Instead of manually incrementing a counter (which drifts), update `handleLog` in both session pages to set `workouts_completed` based on the actual count from `workout_history` after a successful insert. This self-corrects any past discrepancies.

### 2. Add streak logic to handleLog

After logging a workout, calculate whether the streak should increment or reset based on `last_workout_date`:
- If `last_workout_date` is yesterday or today: increment streak
- If `last_workout_date` is null or older than yesterday: reset streak to 1
- Always update `last_workout_date` to today

### 3. Files to change

**`src/pages/WorkoutSession.tsx`** -- Update `handleLog` onSuccess:
- Query workout_history count and set `workouts_completed` to that count
- Add streak calculation logic using `profile.last_workout_date`
- Update `last_workout_date`, `current_streak`, and `longest_streak` in one `updateProfile` call

**`src/pages/QuickSession.tsx`** -- Same changes as WorkoutSession

**`src/hooks/useWorkoutHistory.ts`** -- No changes needed (already invalidates queries on success)

### 4. Streak logic detail

```text
today = current date (date only, no time)
lastDate = profile.last_workout_date (date only)

if lastDate == today:
  // Already worked out today, don't double-count streak
  newStreak = current_streak (unchanged)
else if lastDate == yesterday:
  // Consecutive day, increment
  newStreak = current_streak + 1
else:
  // Gap in training or first workout ever
  newStreak = 1

longestStreak = max(newStreak, longest_streak)
last_workout_date = today
```

### 5. Self-healing workout count

On each log, after the history entry is inserted:
```text
workouts_completed = (current workout_history count for this user)
```

This is done by refetching the history query and using its length, which ensures the count is always accurate regardless of past bugs.
