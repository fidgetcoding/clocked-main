

## Refined "Share to Fight Club" Dialog

### What changes

The current share modal only has a note textarea. We'll upgrade it to a polished, full-featured share form with three additions:

### 1. Custom Workout Name
- Add an editable text input pre-filled with the current workout name
- Users can rename the shared version without affecting their local copy
- Placed at the top of the form with a "Workout Name" label

### 2. Share Destination Selector
- A segmented toggle or radio group letting users pick where the post goes:
  - **Community Feed** (default) -- posts to the global feed visible to all
  - **Early Adopters Club** -- posts to the club feed (if user is a member)
- Future clubs can be added to this list as they're created

### 3. Tags
- A row of toggleable tag chips the user can tap to tag their shared workout
- Tags match the existing category system from the community feed: **Boxing**, **HIIT**, **Conditioning**, **Beginner**, **Intermediate**, **Advanced**, **Cardio**, **Speed Bag**
- Multiple tags can be selected
- Tags are stored in the database and displayed on feed posts

### Database Migration
- Add a `tags` column (`text[]`, nullable, default `'{}'`) to the `community_posts` table
- Add a `custom_name` column (`text`, nullable) for the display name override
- Add a `destination` column (`text`, nullable, default `'feed'`) for share target

### Files to modify

- **`src/pages/Build.tsx`** -- Rebuild the share dialog with name input, destination selector, and tag toggles. Pass `tags`, `custom_name`, and `destination` to the mutation.
- **`src/hooks/useCommunityPosts.ts`** -- Update `useShareWorkout` mutation to accept and insert `tags`, `custom_name`, and `destination`. Update the `CommunityPost` interface to include `tags`.
- **`src/pages/FightClub.tsx`** -- Display tags on feed post cards (small colored chips).
- **Database migration** -- Add `tags`, `custom_name`, and `destination` columns to `community_posts`.

### Technical Details

```text
New community_posts columns:
  tags        text[]    DEFAULT '{}'    NULLABLE
  custom_name text                      NULLABLE
  destination text      DEFAULT 'feed'  NULLABLE

Share dialog layout (top to bottom):
  1. Title: "Share to Fight Club"
  2. Input: "Workout Name" (pre-filled with current name)
  3. Toggle group: "Share to" -> [Community Feed] [Early Adopters]
  4. Tag chips row: [Boxing] [HIIT] [Conditioning] [Beginner] [Intermediate] [Advanced] [Cardio] [Speed Bag]
     - Each chip toggles on/off (volt highlight when active)
  5. Textarea: "Add a note..." (existing)
  6. Buttons: [Cancel] [Share]

Tag constants:
  SHARE_TAGS = ['Boxing', 'HIIT', 'Conditioning', 'Beginner', 'Intermediate', 'Advanced', 'Cardio', 'Speed Bag']
```
