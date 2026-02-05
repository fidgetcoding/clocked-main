
# User Search Feature for Finding and Following Users

## Overview
Add a search feature to the Profile page that allows users to find other users by name or handle, view their profiles, and follow them.

## Current State
- The followers/following modal exists but only shows existing connections
- The `profiles` table RLS policy only allows users to view their own profile
- No search functionality exists for discovering other users

## Implementation Steps

### 1. Database Changes
Update the RLS policy on the `profiles` table to allow authenticated users to view other users' public profile information (name, handle, avatar). This is required for the search to work.

**New RLS Policy:**
- Add a SELECT policy allowing authenticated users to view all profiles
- This enables user discovery while maintaining insert/update/delete restrictions

### 2. Create User Search Hook
Create a new hook `useUserSearch` that:
- Takes a search query string
- Searches the `profiles` table by name or handle using `ilike` for partial matching
- Returns matching users with their basic info (id, name, handle, avatar)
- Excludes the current user from results
- Has debounced search to avoid excessive API calls

### 3. Update Profile Page Modal
Enhance the existing followers/following modal to include:
- A third mode: "search" for finding new users
- Search input field at the top of the modal
- Display search results with user cards
- Each result links to the user's profile page where they can be followed
- Add a "Find People" button or search tab in the modal

### 4. UI/UX Design
- Add a search icon/button on the Profile page to open the search modal
- The modal will have tabs or modes: "Followers", "Following", "Search"
- Search input with real-time results
- User cards showing avatar, name, and handle
- Tapping a result navigates to that user's profile

## Files to Modify
1. **Database Migration** - Add RLS policy for public profile viewing
2. **src/hooks/useUserSearch.ts** (new) - Search hook with debounce
3. **src/pages/Profile.tsx** - Add search modal mode and UI

## Technical Details

### RLS Policy SQL
```sql
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
```

### Search Query Pattern
```typescript
const { data } = await supabase
  .from('profiles')
  .select('user_id, name, handle, avatar_url')
  .or(`name.ilike.%${query}%,handle.ilike.%${query}%`)
  .neq('user_id', currentUserId)
  .limit(20);
```

### Modal Enhancement
The existing `listModal` state will be expanded to include a "search" type, and the modal content will conditionally render a search interface when in search mode.
