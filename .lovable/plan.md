
# XP System Verification & Fix Plan

## Summary
After thoroughly analyzing the uploaded PDF documentation against the current implementation, I've found **significant discrepancies** that need to be corrected for the XP system to work as documented.

---

## Critical Issues Found

### Issue 1: Incomplete Activity XP Rates
The current system only handles 6 activity types. The document specifies **17+ different activities** with unique XP rates.

**Missing activities include:**
- Pushups (0.22/sec)
- Curlups/Situps (0.18/sec)
- Burpees (0.22/sec)
- Squats (0.22/sec)
- Pull-ups (0.30/sec)
- Planks (0.15/sec)
- Walking (0.12/sec)
- Cycling (0.20/sec)
- Jogging (0.18/sec)
- Sparring (2.5-5.0/sec based on prestige)
- Stretching (5 XP flat per stretch)

### Issue 2: Streak Multipliers Incomplete
The document specifies precise multipliers for streaks up to 365+ days, but the code uses a formula-based approach after 100 days instead of the documented values.

**Document values (100+ days):**
- 100-149 days: 2.0x
- 150-199 days: 2.25x
- 200-299 days: 2.5x
- 300-364 days: 2.75x
- 365+ days: 3.0x (cap)

### Issue 3: Streak Milestones Wrong
Multiple milestone bonuses have incorrect values or are missing entirely:
- Day 20: Code says 5,000, doc says 4,000
- Days 25, 50, 75, 150, 200, 250: Completely missing
- Day 100: Code says 100,000, doc says 35,000

### Issue 4: Combo XP Formula Not Implemented
The document describes a detailed combo calculation formula using:
- Individual punch values (Jab=5, Cross=6.5, Hook=8, etc.)
- Defense values (Slip=7.25, Duck=8.5, Roll=9.5, etc.)
- Length multipliers (4 moves=1.1x, 5 moves=1.2x, 6+=1.35x)
- Defense bonus multipliers (1 defense=1.15x, 2=1.3x, 3+=1.45x)

Currently, combos simply earn 0.33 XP/sec + 0.5 per combo landed.

---

## Implementation Plan

### Phase 1: Update Activity XP Rates
Expand the `ACTIVITY_XP_RATES` object in `src/lib/xpSystem.ts` to include all documented activities with their precise rates.

### Phase 2: Fix Streak Multipliers
Replace the formula-based calculation with the exact documented tier values for all streak ranges up to 365+.

### Phase 3: Correct Streak Milestones
Update the `STREAK_MILESTONES` object to match the documented values exactly.

### Phase 4: Implement Combo XP Formula
Add a new function to calculate combo XP based on:
1. Sum of move values in the combo
2. Apply length multiplier
3. Apply defense move multiplier
4. Factor in duration

### Phase 5: Update WorkoutSession
Modify the segment activity detection to properly map segment names to the expanded activity types.

---

## Technical Details

### File Changes Required

**1. src/lib/xpSystem.ts**
- Expand `ActivityType` to include all 17+ activity types
- Update `ACTIVITY_XP_RATES` with all documented rates
- Add punch/defense value constants
- Add combo calculation function with length/defense bonuses
- Fix `getStreakMultiplier()` to use documented tier values
- Fix `STREAK_MILESTONES` to match documented values

**2. src/pages/WorkoutSession.tsx**
- Update `getActivityTypeFromSegment()` to detect all activity types
- Optionally implement combo XP formula for combo segments

---

## Verification Testing
After implementation, testing should verify:
1. Shadow boxing earns ~0.33 XP/sec
2. Rest earns ~0.01 XP/sec
3. Pushups earn ~0.22 XP/sec
4. 100+ day streak applies 2.0x (not formula)
5. Day 20 milestone gives 4,000 XP (not 5,000)
6. Day 100 milestone gives 35,000 XP (not 100,000)
