

# Fix: Following List and User Search

## Problem
Two features are broken because of Row-Level Security on the `profiles` table:

1. **Following/Followers list shows empty** -- The `profiles_public` view selects from `profiles`, but the view uses the caller's permissions. RLS on `profiles` only lets you see your own row, so looking up Dan and a tester returns nothing.

2. **Search returns no results** -- The `useUserSearch` hook queries the `profiles` table directly with the same RLS restriction, so you can never find other users.

## Root Cause
The `profiles_public` view was created without disabling security invoker, so it inherits the calling user's RLS restrictions rather than bypassing them.

## Solution

### Step 1: Recreate the `profiles_public` view (database migration)
Drop and recreate the view with `security_invoker = false` so it runs as the view owner (bypassing RLS). This is safe because the view already only exposes non-sensitive columns.

```sql
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = false)
AS SELECT
  id, user_id, name, handle, avatar_url, bio, role,
  total_xp, current_level, prestige,
  workouts_completed, current_streak,
  total_training_seconds, sessions_completed_this_year,
  created_at
FROM public.profiles;
```

### Step 2: Update `useUserSearch` to query `profiles_public` instead of `profiles`
Change the search hook to query the public view so it can find other users. Map the returned fields accordingly.

**File:** `src/hooks/useUserSearch.ts`
- Change `.from('profiles')` to `.from('profiles_public')`
- Keep the same `.select()` and `.ilike()` filters

### Step 3: Grant SELECT on the view to authenticated users
```sql
GRANT SELECT ON public.profiles_public TO authenticated;
```

## What This Fixes
- Clicking "Following" will show Dan, a tester, and any other followed users
- Clicking "Followers" will show anyone following you
- The search modal will find users by name
- No sensitive data is exposed (the view only includes public columns)

