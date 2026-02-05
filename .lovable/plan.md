
# Fix: User Data Isolation - Workouts Bleeding Across Accounts

## Problem Summary

You're experiencing a critical data isolation issue where:
1. Workouts you add/edit appear in other users' accounts
2. New users see workouts that weren't meant for them
3. Changes made to presets affect all users universally

This is a multi-tenant data isolation failure.

## Root Cause Analysis

The app is using **two conflicting data systems** simultaneously:

### 1. Zustand + localStorage (The Problem)
All the Zustand stores use `persist` middleware with **shared localStorage keys** that are NOT namespaced by user:

| Store | localStorage Key | Problem |
|-------|------------------|---------|
| `workoutStore` | `get-clocked-workouts` | Shared across ALL users on same device |
| `userStore` | `get-clocked-user` | Shared across ALL users |
| `historyStore` | `get-clocked-history` | Shared across ALL users |
| `timerStore` | `get-clocked-timer` | Shared (less critical) |

When User A logs out and User B logs in on the same device, User B sees User A's localStorage data because **the keys don't include the user ID**.

### 2. Supabase Database (Not Being Used for Workouts)
There's a `useWorkouts` hook that correctly fetches from Supabase with user filtering (`.eq('user_id', user.id)`), but:
- The Index page uses `useWorkoutStore` (localStorage), NOT `useWorkouts`
- The Build page uses `useWorkoutStore` (localStorage), NOT `useWorkouts`
- Presets are loaded from static data into localStorage, shared across accounts

### Flow of the Bug

```text
1. User A signs up → presets loaded to localStorage
2. User A adds "Morning Shadow Boxing" → stored in localStorage
3. User A logs out (localStorage NOT cleared)
4. User B signs up → sees User A's data from localStorage!
5. User B edits a preset → User A sees the edit next time
```

## Solution Overview

Migrate from localStorage-based Zustand stores to Supabase-backed data with proper user isolation.

### Phase 1: Clear localStorage on Auth State Change

When a user logs out or a new user logs in, clear user-specific localStorage data.

**File: `src/contexts/AuthContext.tsx`**
- Add logic to clear localStorage keys on logout
- Add logic to clear React Query cache when user changes
- Clear Zustand stores when auth state changes

### Phase 2: Namespace localStorage by User ID (Interim Solution)

Update Zustand persist configuration to use user-specific keys.

**File: `src/stores/workoutStore.ts`**
- Change persist key from `get-clocked-workouts` to include user ID
- Add migration logic for existing data

**File: `src/stores/userStore.ts`**
- Same pattern for user-specific storage

**File: `src/stores/historyStore.ts`**
- Same pattern for history data

### Phase 3: Migrate Workouts to Supabase (Long-term Solution)

Replace localStorage workout storage with the existing Supabase `workouts` table.

**File: `src/pages/Index.tsx`**
- Replace `useWorkoutStore` with `useWorkouts` hook
- Load presets from database, not static files
- Handle preset seeding on first login

**File: `src/pages/Build.tsx`**
- Replace `useWorkoutStore` mutations with `useWorkouts` mutations
- Ensure all CRUD operations go to Supabase

### Phase 4: Handle Preset Initialization Per User

When a new user signs up:
1. Check if they have any workouts in the database
2. If not, seed their account with the appropriate presets based on experience level
3. Mark presets with `is_preset: true` so they can be identified

**New file: `src/hooks/usePresetSeeding.ts`**
- Check if user needs presets
- Insert user-specific copies of presets into database
- Run once on first login

### Phase 5: Community Preset Update Notification

When a user shares a workout to community and later edits it:
1. Track shared workout IDs
2. On edit, check if this workout was shared
3. Show prompt asking if they want to update the community post

**File: `src/pages/Build.tsx`**
- Add check on save for community-shared workouts
- Show update prompt dialog

## Code Changes Summary

### AuthContext.tsx
- Add `useEffect` to clear localStorage on logout
- Clear React Query cache when user changes
- Reset Zustand stores

### workoutStore.ts
- Remove `persist` middleware entirely (move to Supabase)
- Keep only for temporary session state if needed

### Index.tsx
- Import `useWorkouts` hook instead of `useWorkoutStore`
- Add preset seeding logic for new users
- Use database-backed workout list

### Build.tsx
- Use `useWorkouts` mutations for add/update
- Remove `useWorkoutStore` dependency

### New: usePresetSeeding.ts
- Check if user has workouts
- Seed experience-level-appropriate presets
- Mark as completed in profile

## Database Changes

None required - the `workouts` table already exists with proper RLS:
- `is_preset` column exists
- `user_id` filtering is in place
- RLS policies restrict access to own workouts

## Migration Strategy

1. Clear localStorage for existing users on next login
2. Seed their account with presets if they have none in database
3. Optionally: migrate localStorage workouts to database (one-time)

## Testing Checklist

After implementation:
- [ ] Create Account A, add custom workout, log out
- [ ] Create Account B - should NOT see Account A's workouts
- [ ] Edit preset in Account B - Account A's preset unchanged
- [ ] Share workout to community, edit it - prompted to update
- [ ] New user sees only experience-level-appropriate presets
