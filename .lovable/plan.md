
# Complete XP and Gamification System Implementation Plan

## ✅ IMPLEMENTATION STATUS: PHASE 1-4 COMPLETE

## Overview
This plan implements the comprehensive gamification system from the Get Clocked XP System document. The system introduces a new Prestige-based hierarchy, replacing the old "Rank" system with a three-tier structure: **Prestige** (experience tier), **Ranking** (progression within prestige), and **Level** (1-100 per prestige).

### Key Display Format
`"Beginner - Prospect - Level 1"` (for new users like bluegum) ✅ IMPLEMENTED

---

## Phase 1: Database Schema Updates

### 1.1 Add New Profile Fields
Add columns to the `profiles` table to track the new gamification data:

```sql
ALTER TABLE profiles ADD COLUMN prestige text DEFAULT 'rookie';
ALTER TABLE profiles ADD COLUMN current_level integer DEFAULT 1;
ALTER TABLE profiles ADD COLUMN combos_landed integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN total_training_seconds integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN sessions_completed_this_year integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN last_workout_date date;
ALTER TABLE profiles ADD COLUMN streak_multiplier decimal(3,2) DEFAULT 1.0;
```

### 1.2 Create Badges Table
Track earned achievement badges:

```sql
CREATE TABLE badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  badge_id text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  xp_rewarded integer DEFAULT 0,
  UNIQUE(user_id, badge_id)
);
```

### 1.3 Create Personal Records Table
Track user personal records:

```sql
CREATE TABLE personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  record_type text NOT NULL,
  value numeric NOT NULL,
  achieved_at timestamptz DEFAULT now(),
  UNIQUE(user_id, record_type)
);
```

---

## Phase 2: Core XP System Types

### 2.1 Replace Existing Types in `src/types/index.ts`

Replace the old `Rank` system with the new prestige-based system:

```typescript
// Prestige Tiers (5 total)
export type Prestige = 'rookie' | 'beginner' | 'intermediate' | 'advanced' | 'pro';

// Rankings within each prestige (10 rankings, levels 1-100)
export type Ranking = 
  | 'prospect'   // Levels 1-10
  | 'scrapper'   // Levels 11-20
  | 'fighter'    // Levels 21-30
  | 'warrior'    // Levels 31-40
  | 'gladiator'  // Levels 41-50
  | 'veteran'    // Levels 51-60
  | 'phenom'     // Levels 61-70
  | 'icon'       // Levels 71-80
  | 'apex'       // Levels 81-90
  | 'champion';  // Levels 91-100

// Prestige display names
export const PRESTIGE_NAMES: Record<Prestige, string> = {
  rookie: 'Rookie',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  pro: 'Pro',
};

// Ranking display names
export const RANKING_NAMES: Record<Ranking, string> = {
  prospect: 'Prospect',
  scrapper: 'Scrapper',
  fighter: 'Fighter',
  warrior: 'Warrior',
  gladiator: 'Gladiator',
  veteran: 'Veteran',
  phenom: 'Phenom',
  icon: 'Icon',
  apex: 'Apex',
  champion: 'Champion',
};
```

### 2.2 Create New XP Calculation Utility
Create `src/lib/xpSystem.ts` with all XP formulas:

- **Level XP Formulas** (per prestige):
  - Rookie: `XP(n) = 220 + (n * 8.8)`
  - Beginner: `XP(n) = 1,100 + (n * 1.5)`
  - Intermediate: `XP(n) = 1,260 + (n * 2.5)`
  - Advanced: `XP(n) = 2,517.5 + (n * 5)`
  - Pro: `XP(n) = 4,156.5 + (n * 4)`

- **Activity XP Rates**:
  - Shadow boxing: 0.33 XP/sec
  - Jump rope: 0.20 XP/sec
  - Running: 0.25 XP/sec
  - Rest: 0.01 XP/sec
  - Combos: calculated via formula

- **Streak Multipliers**:
  - 0-2 days: 1.0x
  - 3-6 days: 1.1x
  - 7-13 days: 1.25x
  - 14-29 days: 1.4x
  - 30-59 days: 1.6x
  - 60-99 days: 1.8x
  - 100+ days: scales up to 3.0x cap

---

## Phase 3: Onboarding Integration

### 3.1 Map Experience Level to Starting Prestige
When a user completes onboarding, set their initial prestige based on experience level selection:

| Onboarding Selection | Starting Prestige |
|---------------------|-------------------|
| Rookie (complete_beginner) | Rookie, Prospect, Level 1 |
| Beginner | Beginner, Prospect, Level 1 |
| Intermediate | Intermediate, Prospect, Level 1 |
| Advanced | Advanced, Prospect, Level 1 |
| Pro | Pro, Prospect, Level 1 |

### 3.2 Update Profile Creation
Modify `useProfile.ts` and the database trigger to set initial prestige based on `experience_level`.

---

## Phase 4: XP Award System

### 4.1 Create XP Award Hook
Create `src/hooks/useXPAwards.ts` to handle all XP calculations:

- Calculate base XP from activity duration and type
- Apply streak multiplier
- Award completion bonuses (+10% for full workout, no skips)
- Check for badge unlocks
- Update user profile

### 4.2 Update Workout Session
Modify `WorkoutSession.tsx` to:
- Track activity types (shadowboxing, combo, rest, etc.)
- Calculate XP per segment based on activity type and duration
- Apply streak multiplier at workout completion
- Show XP earned with proper breakdown

### 4.3 Streak Milestone Bonuses
Award bonus XP at streak milestones:
- 5 days: +500 XP
- 10 days: +1,500 XP
- 15 days: +3,000 XP
- And so on per document

---

## Phase 5: Profile Display Updates

### 5.1 Update Profile Page
Modify `Profile.tsx` to show:
- **Display Format**: "Beginner - Prospect - Level 1"
- Prestige badge with styling
- Progress bar showing XP to next level
- Secondary progress showing "3 workouts until Gladiator"

### 5.2 Update XP Bar Components
Modify `XPBar.tsx` and `VerticalXPBar.tsx`:
- Calculate level progress within current prestige
- Show ranking name instead of old rank names
- Display prestige tier

### 5.3 Stats Page Updates
Modify `Stats.tsx` to show:
- Current Prestige/Ranking/Level
- Progress to next ranking
- Prestige completion percentage
- Next badge preview

---

## Phase 6: Badge System

### 6.1 Define All Badges
Create `src/data/badges.ts` with badge definitions:

**Milestone Badges**:
- First Blood (first workout): +50 XP
- Rookie of the Year (complete Rookie prestige): +500 XP
- Class Act (complete Beginner prestige): +1,500 XP
- etc.

**Streak Badges**:
- Warming Up (7 days): +150 XP
- Iron Chin (30 days): +750 XP
- Unbreakable (60 days): +2,000 XP
- etc.

**Volume Badges**:
- Punching In (10 workouts): +150 XP
- Regular (50 workouts): +500 XP
- Dedicated (100 workouts): +1,500 XP
- etc.

### 6.2 Badge Check System
Create a utility to check badge eligibility after each workout and award accordingly.

---

## Phase 7: Data Migration

### 7.1 Migrate Existing Users
For existing users like "bluegum" who has:
- `experience_level: 'beginner'`
- `total_xp: 0`
- `workouts_completed: 0`

Set their gamification state to:
- `prestige: 'beginner'` (based on their onboarding selection)
- `current_level: 1`
- Ranking: Prospect (derived from level 1)

---

## Technical Implementation Details

### Files to Create:
1. `src/lib/xpSystem.ts` - Core XP calculation functions
2. `src/data/badges.ts` - Badge definitions
3. `src/hooks/useXPAwards.ts` - XP award hook
4. `src/hooks/useBadges.ts` - Badge management hook
5. `src/components/ui/PrestigeDisplay.tsx` - Display component for prestige/ranking/level

### Files to Modify:
1. `src/types/index.ts` - Replace Rank types with Prestige/Ranking
2. `src/pages/Profile.tsx` - Update display format
3. `src/pages/Stats.tsx` - Update rank ladder and displays
4. `src/pages/WorkoutSession.tsx` - Integrate XP calculation
5. `src/components/ui/XPBar.tsx` - Update for new system
6. `src/components/ui/VerticalXPBar.tsx` - Update for new system
7. `src/stores/userStore.ts` - Add prestige/level management
8. `src/hooks/useProfile.ts` - Add new fields
9. `src/pages/Onboarding.tsx` - Set initial prestige based on experience

### Database Migrations:
1. Add new columns to profiles table
2. Create badges table
3. Create personal_records table
4. Update RLS policies

---

## Verification Steps
After implementation:
1. Check that bluegum (nate@lorecraft.io) shows: "Beginner - Prospect - Level 1"
2. Verify new users get correct starting prestige based on onboarding
3. Test XP awards during workout with proper activity-based calculations
4. Verify streak multipliers apply correctly
5. Test badge unlock system
6. Confirm profile displays show new format correctly
