

# Fix Level Sync, Workout Count, and Admin-Only Test Button

## Issues Found

1. **Level shows "1" in workout session despite being level 2**: The WorkoutSession page reads from the local Zustand store (`useUserStore`), which has stale data. The Profile and Stats pages correctly read from the database via `useProfile()`. When you load a workout, it grabs `user?.totalXP` and `user?.prestige` from localStorage -- which may still hold old values from before your last session was saved to the database.

2. **Workouts count is 0 despite having logged workouts**: The `handleLog` function in WorkoutSession saves the workout to `workout_history` but never increments `profiles.workouts_completed`. Same issue exists in QuickSession. The counter in the database is stuck at 0.

3. **Calories**: These are calculated correctly from your workout history entries (duration x rate based on difficulty feedback). They will correlate properly once workout history entries are being logged.

4. **Admin test button visible to everyone**: The Zap button needs to be restricted to your account only.

## Plan

### 1. Fix Level Sync in WorkoutSession (and QuickSession)

Replace the Zustand-based level/XP/prestige reads with database-backed data from `useProfile()`. Specifically:

- Use `profile?.total_xp` instead of `user?.totalXP` for the base XP in `liveLevel` calculation
- Use `profile?.prestige` instead of `user?.prestige` for prestige tier
- Initialize `prevLevelRef` from the profile's calculated level, not the local store's `currentLevel`
- Keep using `accumulatedXP` for the real-time in-session accumulation (this part is correct)

This ensures when you open any workout, the starting level matches what the database says (level 2), and XP accumulates from there.

### 2. Increment workouts_completed on Log

In the `handleLog` function (both WorkoutSession and QuickSession), after successfully saving to `workout_history`, also call `updateProfile` to increment `workouts_completed`:

```text
updateProfile.mutate({ 
  workouts_completed: (profile?.workouts_completed || 0) + 1 
})
```

This keeps the counter in sync with actual logged workouts.

### 3. Admin-Only Test Button

Create a `user_roles` table with proper RLS and a `has_role` security definer function (following the established security pattern). Assign your account (`nate@lorecraft.io`) the `admin` role. Then conditionally render the Zap test button only when the authenticated user has the admin role.

**Database changes:**
- Create `app_role` enum: `admin`, `moderator`, `user`
- Create `user_roles` table with RLS
- Create `has_role()` security definer function
- Insert admin role for your user ID (`8a3fdf60-f42f-42d1-8ebc-f0b6a3a43693`)

**Frontend:**
- Create a `useUserRole()` hook that queries `user_roles` for the current user
- Wrap the Zap button in `{isAdmin && (...)}` conditional

### 4. Files to Change

- **New migration**: Create `user_roles` table, enum, `has_role` function, seed admin role
- **New hook**: `src/hooks/useUserRole.ts` -- queries user_roles for current user
- **`src/pages/WorkoutSession.tsx`** -- Use profile data for level/XP, increment workouts_completed on log, admin-gate the test button
- **`src/pages/QuickSession.tsx`** -- Same level/XP fix and workouts_completed increment
- **`src/hooks/useProfile.ts`** -- Add `updateProfile` to the return if not already exposed (it is already returned)
