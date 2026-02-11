

# Add Weight/Height to Profile for Better Calorie Estimates + Add Estimate Label

## Calorie Methodology Context

The current 8/10/12 cal/min rates are based on published exercise science data (ACE, ACSM studies cite boxing at ~7-13 cal/min depending on intensity). They're validated as a general range but not personalized. Adding body weight allows using the **MET (Metabolic Equivalent) formula**, which is the standard approach in fitness apps:

```text
Calories/min = MET x weight(kg) x 3.5 / 200
```

Boxing MET values (from the Compendium of Physical Activities):
- Light/shadowboxing: ~5.5 MET
- Moderate (bag work): ~7.8 MET  
- Intense (sparring-level): ~12.8 MET

This gives meaningfully more accurate estimates when body weight is known.

## Changes

### 1. Add weight and height fields to profiles table

- Add `weight_kg` (numeric, nullable) and `height_cm` (numeric, nullable) columns to the `profiles` table
- These remain optional -- if not set, fall back to current flat-rate estimates

### 2. Add weight/height inputs to Edit Profile page

- Add two new fields to `src/pages/EditProfile.tsx` for weight and height
- Support both metric and imperial with a toggle (store in metric internally)
- Keep it simple: two number inputs with unit labels

### 3. Improve calorie calculation in useWorkoutStats

- When `profile.weight_kg` is available, use the MET-based formula instead of the flat rate
- Map difficulty feedback to MET values: too_easy = 5.5, just_right = 7.8, too_hard = 12.8
- Fall back to current flat rates if weight is not set

### 4. Add "Estimate" label to calories on Stats page

- Append a small "(est.)" or info icon tooltip next to the calories value on the Stats page so users know it's an approximation

### 5. XP Bar confirmation

No changes needed -- the XP bar is already correctly synced. It reads `profile.total_xp` from the database and adds the in-session `accumulatedXP` on top. When you enter a new workout, it pulls your current progress from the database, so the bar fill reflects your actual position between levels.

## Files to Change

- **New migration**: Add `weight_kg` and `height_cm` columns to `profiles`
- **`src/pages/EditProfile.tsx`**: Add weight/height input fields
- **`src/hooks/useWorkoutStats.ts`**: Use MET formula when weight is available
- **`src/pages/Stats.tsx`**: Add "(est.)" label to calories stat
- **`src/hooks/useProfile.ts`**: Ensure weight/height fields are included in profile queries (should auto-include with `select('*')`)

