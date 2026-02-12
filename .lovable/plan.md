

# Social Feed and Sharing Overhaul

## Summary

This plan restructures how posts flow through feeds, adds auto-posting on workout completion, revamps the share dialog with Public/Private + club selection, and adds a "Shared Workouts" management section to the Profile page. All changes apply universally for all users.

---

## 1. Update the `community_posts` table

Add a `club_id` column so private posts can target a specific club (not just a generic "club" destination).

```sql
ALTER TABLE community_posts ADD COLUMN club_id uuid REFERENCES clubs(id) ON DELETE SET NULL;
```

The `destination` column will now use:
- `'feed'` = Public (visible in the ALL feed)
- `'club'` = Private (visible only in the specific club's feed, identified by `club_id`)

---

## 2. Auto-post on Workout Completion

In `src/pages/WorkoutSession.tsx`, after the user logs a workout (`handleLog` -> `onSuccess`), automatically insert a `workout_complete` post into `community_posts` with `destination: 'feed'`. This makes workout completions visible to all users in the ALL feed and to followers in the Following feed.

Post data:
- `type: 'workout_complete'`
- `workout_name`: the workout name
- `message`: auto-generated (e.g., "Completed [workout name]!")
- `destination: 'feed'`
- No workout_data (so it won't appear as a downloadable preset)

---

## 3. Revamp Share Dialog (Build page)

Replace the current "Community Feed / Early Adopters" toggle with:
- **Public** / **Private** toggle
- When **Private** is selected, show a submenu listing the user's joined clubs (fetched via `useClubs` -> `myMemberships` + `clubs`)
- User selects which club to share to
- On share: `destination = 'feed'` for Public, `destination = 'club'` + `club_id = selectedClubId` for Private

---

## 4. Feed Filtering Logic Updates

### ALL feed (`useCommunityPosts` with destination='feed')
- Shows all posts where `destination = 'feed'` or `destination IS NULL` (legacy)
- This includes both `preset_shared` AND `workout_complete` posts

### Following feed
- Same as ALL but filtered to users the current user follows

### Club feed (when viewing a specific club)
- Filter by `destination = 'club'` AND `club_id = specificClubId`

### Presets tab in Fight Club
- Remove the separate "Community Shared" header
- Merge community shared presets (type=`preset_shared`) into the existing trending list under "Trending"

---

## 5. Delete Posts / Unshare Workouts

### From the Feed
- If a post belongs to the current user (`post.user_id === authUser.id`), show a delete/trash icon on the post card
- On click, call `supabase.from('community_posts').delete().eq('id', postId)` (RLS already allows users to delete their own posts)
- Invalidate the `community-posts` query

### From the Workout itself (Build page)
- When editing a workout that has been shared, show an "Unshare" option
- This queries `community_posts` for matching `workout_id` and deletes those entries

---

## 6. Profile: "Shared Workouts" Section

Add a "Shared Workouts" button on the Profile page (own profile only). Clicking it opens a modal/page showing:
- Toggle: **Public** / **Private**
  - Public: shows all the user's posts with `destination = 'feed'` and `type = 'preset_shared'`
  - Private: shows all the user's posts with `destination = 'club'`, grouped by club
- Each item has a delete button to unshare (remove from community_posts)
- Deleting correlates immediately in the respective feeds

A new hook `useMySharedWorkouts` will fetch `community_posts` filtered by `user_id = authUser.id` and `type = 'preset_shared'`.

---

## 7. Feed Post UI for Different Types

Add rendering for `workout_complete` posts in the feed:
- "[User] completed [Workout Name]" with XP earned badge
- No download button (no workout_data)
- Shows time ago, likes

`preset_shared` posts remain as they are with the download/save button.

---

## Technical Details

### Files to modify:
1. **Database migration** - Add `club_id` column to `community_posts`
2. **`src/hooks/useCommunityPosts.ts`** - Update query to accept `clubId` param for club-specific feeds, add delete mutation, add `useMySharedWorkouts` hook
3. **`src/pages/WorkoutSession.tsx`** - Auto-post `workout_complete` on log success
4. **`src/pages/Build.tsx`** - Revamp share dialog with Public/Private + club submenu
5. **`src/pages/FightClub.tsx`** - Remove "Community Shared" header, merge into trending; add delete button on own posts; update club feed to filter by `club_id`; render `workout_complete` post type
6. **`src/pages/Profile.tsx`** - Add "Shared Workouts" button and modal with Public/Private toggle and delete functionality
7. **`src/hooks/useClubs.ts`** - No changes needed, already provides `myMemberships` and `clubs`

### New hook:
- `useDeleteCommunityPost()` - mutation to delete a post by ID
- `useMySharedWorkouts()` - query for current user's shared presets

### Data flow:
```text
User completes workout --> handleLog onSuccess --> auto-insert workout_complete post (destination='feed')
User shares preset (Public) --> insert preset_shared post (destination='feed')  
User shares preset (Private) --> insert preset_shared post (destination='club', club_id=X)
ALL feed --> destination='feed' OR destination IS NULL
Following feed --> same + filter by followed user_ids
Club feed --> destination='club' AND club_id=specific_club
Profile Shared Workouts --> user's own preset_shared posts, toggle Public/Private view
```

