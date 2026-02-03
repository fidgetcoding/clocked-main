
# Plan: Add "Share to Community Feed" Feature

## Overview
Add the ability for users to share their workouts (including preset workouts) to the community feed directly from the Edit Set window. This will create a "preset_shared" type post visible in the Fight Club feed.

## Database Changes

### New Table: `community_posts`
This table will store all community feed posts, including shared presets.

```sql
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL, -- 'workout_complete', 'preset_shared', 'rank_up', 'streak_milestone'
  workout_id text, -- References the workout being shared
  workout_name text,
  workout_data jsonb, -- Full workout structure for shared presets
  message text, -- Optional message from the user
  likes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

RLS policies will allow:
- Anyone authenticated can view all posts (community is public)
- Users can only insert their own posts
- Users can only delete their own posts

## UI Changes

### File: `src/pages/Build.tsx`

Add a "Share" button in the header area near the spacer, visible when editing an existing workout:

```
Location: Line ~314-322 (header section)

Before:
┌─────────────────────────────────────────┐
│  ← Back       Edit Set        [spacer]  │
└─────────────────────────────────────────┘

After:
┌─────────────────────────────────────────┐
│  ← Back       Edit Set         [Share]  │
└─────────────────────────────────────────┘
```

The Share button will:
- Only appear when editing an existing workout (`editId` is present)
- Open a confirmation dialog with an optional message field
- Post to the community feed using the new `useCommunityPosts` hook
- Show a success toast: "Shared to Fight Club!"

## New Files

### `src/hooks/useCommunityPosts.ts`
A React Query-based hook for:
- `useCommunityPosts()` - Fetch all community posts
- `useShareWorkout()` - Share a workout to the community feed

## Updated Files

### `src/pages/FightClub.tsx`
Update the Feed tab to:
- Fetch real posts from `community_posts` table
- Join with `profiles` table to get user info
- Display `preset_shared` posts with a "Save Workout" button
- Keep existing mock data as fallback for demo purposes

## User Flow

1. User opens an existing workout in Edit Set
2. User clicks "Share" button (icon: Share2 from lucide)
3. Dialog appears: "Share to Fight Club?"
   - Optional message input: "Add a note about this workout..."
   - "Cancel" and "Share" buttons
4. On share:
   - Post created in `community_posts` table
   - Toast: "Shared to Fight Club!"
   - Dialog closes
5. Post appears in Fight Club > Feed tab

## Technical Details

- The workout data is stored as JSONB so other users can save it to their library
- User info (name, avatar) is fetched via join with profiles
- Posts are ordered by `created_at DESC` (newest first)
- The Share button uses the existing `Share2` icon from lucide-react

## Security

- RLS ensures users can only create posts for themselves
- Workout data is sanitized before storing (no sensitive user info)
- Public read access allows community viewing
