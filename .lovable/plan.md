
# Remove Mock Data and Add Early Adopters Club

## Overview
Clean up all fake demo accounts, clubs, and placeholder data throughout the app. Keep only one demo user (renamed to "Demo" with handle @demo) and their LIVE feed post. Create a real "Early Adopters" club capped at 100 members. Ensure the feed only shows actual user activity from the database.

## Changes Required

### 1. Update Mock Users in Profile.tsx
**File: `src/pages/Profile.tsx`**

- Reduce `MOCK_USERS` to only contain the Demo user
- Rename "Sarah Chen" to "Demo" with handle `@demo`
- Remove all other mock users (Mike Thompson, Alex Rodriguez, Jamie Lee)

### 2. Update Feed Mock Data in FightClub.tsx
**File: `src/pages/FightClub.tsx`**

**Mock Feed Posts (lines 141-145):**
- Keep only the Demo "LIVE" post showing "Currently doing: Heavy Bag Blast"
- Update name from "Sarah Chen" to "Demo"
- Remove Mike Thompson and James Wilson mock posts

**My Clubs (lines 131-134):**
- Remove "Iron Fist Boxing" and "Morning Grinders" fake clubs
- Replace with "Early Adopters" club (capped at 100 members)

**Discover Clubs (lines 136-138):**
- Remove "Global Fighters" fake club
- This section can be empty or removed

**Club Chat Messages (lines 43-47):**
- Remove fake chat messages from "Coach Mike" and "Alex R."
- Start with empty array or placeholder for when real chat is implemented

**Club Feed (lines 162-166):**
- Remove fake posts from "Coach Mike", "Alex R.", and "Sarah C."
- Start with empty array

**Club Leaderboard (lines 223-229):**
- Remove fake leaderboard data
- Start with empty array or show placeholder message

### 3. Update Trending Workouts in trendingWorkouts.ts
**File: `src/data/trendingWorkouts.ts`**

- Keep only the workout by "Demo" (rename Sarah Chen's "Quick Morning Jabs" to be by Demo)
- Remove all other mock workouts by Mike Thompson, James Wilson, Alex Rodriguez, Coach Davis, Flash Martinez
- OR: Clear the entire array to only show real community-shared presets

### 4. Early Adopters Club
**In FightClub.tsx clubs section:**

Create a single club:
```typescript
const myClubs: Club[] = [
  { 
    id: 'early-adopters', 
    name: 'Early Adopters', 
    icon: '🚀', 
    type: 'public', 
    memberCount: 0,  // Will be tracked from real data eventually
    activeNow: 0,
    maxMembers: 100  // Add new property for cap
  },
];
```

The Discover section will be empty since we're removing fake clubs.

## Summary of Removals

| Location | Items to Remove |
|----------|----------------|
| Profile.tsx MOCK_USERS | mike-thompson, alex-rodriguez, jamie-lee |
| FightClub.tsx mockFeedPosts | Mike Thompson post, James Wilson post |
| FightClub.tsx myClubs | Iron Fist Boxing, Morning Grinders |
| FightClub.tsx discoverClubs | Global Fighters |
| FightClub.tsx clubChatMessages | All fake messages |
| FightClub.tsx clubFeed | All fake posts |
| FightClub.tsx clubLeaderboard | All fake entries |
| trendingWorkouts.ts | All workouts except Demo's |

## Items to Keep/Rename

| Item | Change |
|------|--------|
| Sarah Chen | Rename to "Demo" with handle @demo |
| LIVE feed post | Keep, update to show Demo user |
| Quick Morning Jabs workout | Rename author to Demo |
| Early Adopters club | Add new, cap at 100 |

## Technical Details

The feed will now prioritize real `community_posts` from Supabase. The Demo LIVE post will remain as a single static example showing the "Watch" feature. All clubs will be placeholder until real club functionality is implemented with database backing.
