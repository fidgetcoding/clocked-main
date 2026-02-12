

## AI Builder: Smart Difficulty Classification and Prestige-Aware Combo Selection

### Problem
When the AI builder generates a workout:
- It doesn't analyze the actual combo content to determine the correct difficulty tier
- If a user provides combos with punches 5-8, STEP IN/OUT, CIRCLE, etc., the workout still drops in as "Beginner"
- When no difficulty is specified in the prompt, it falls back to `experienceLevel` (a string like `'complete_beginner'`) instead of the user's actual prestige from their profile
- Combos generated when none are specified don't pull from the combo preset library (`comboPresets.ts`)

### Solution

#### 1. Add combo content analysis function (`aiWorkoutParser.ts`)

Create a new function `classifyDifficultyFromCombos(combos: string[][])` that inspects the actual punch numbers, defense moves, and footwork in the combos:
- If any combo contains punches 7-8, or movements like STEP IN/STEP OUT: classify as **advanced**
- If any combo contains punches 5-6, or PULL/BLOCK/CIRCLE: classify as **intermediate**
- Otherwise: **beginner**

This function will be called after combos are parsed from the prompt. If the user-specified combos imply a higher difficulty than what `inferDifficulty` returned, the difficulty gets upgraded to match.

#### 2. Update `inferDifficulty` to handle prestige strings

The `userLevel` parameter currently receives values like `'complete_beginner'`, `'beginner'`, `'intermediate'`, `'advanced'`, `'pro'`. The function already handles most of these, but `'complete_beginner'` and `'rookie'` (prestige value) are not mapped. Add those mappings so the fallback works correctly regardless of whether `experienceLevel` or `prestige` is passed.

#### 3. Pass user prestige as fallback in `AIBuilderModal.tsx`

Update the `handleGenerate` call to prefer the database profile's `prestige` field over the local store's `experienceLevel`. The modal already has access to the user store; we'll also check if a profile hook value is available, or map `experienceLevel` through `experienceLevelToPrestige` for consistency.

#### 4. Pull combos from preset library when none specified

When no combos are parsed from the prompt AND the bag type supports combos (heavy bag, double end, shadowboxing), instead of using hardcoded combo arrays:
- Import `getAllPresets` from `comboPresets.ts`
- Use the resolved difficulty tier to call `getAllPresets(difficulty)`
- Select combos from the appropriate preset pool, cycling through them for each round

This ensures the Freestyle Rule is still respected (no combos = Freestyle), but when the system does generate combos (because the context calls for combo work), they come from the proper difficulty-appropriate preset library.

#### 5. Auto-upgrade difficulty when combo content exceeds tier

In `parseWorkoutInput` (the main parser), after all combos are collected and difficulty is inferred:
- Run `classifyDifficultyFromCombos` on the parsed combos
- If the combo-derived difficulty is higher than the inferred difficulty, upgrade
- This ensures "5 rounds heavy bag with 1-2-5-6-3-2" correctly drops as intermediate, not beginner

### Files to modify

- **`src/lib/aiWorkoutParser.ts`** -- Add `classifyDifficultyFromCombos`, update `inferDifficulty` mappings, integrate combo-based difficulty upgrade in `parseWorkoutInput`
- **`src/components/AIBuilderModal.tsx`** -- Update `generateWorkoutFromPrompt` legacy path to use preset combos instead of hardcoded arrays; map `experienceLevel` through prestige mapping for consistent fallback

### Technical Details

```text
Difficulty classification from combo content:

ADVANCED indicators:
  Punches: 7, 8
  Movement: STEP IN, STEP OUT

INTERMEDIATE indicators:
  Punches: 5, 6
  Defense: PULL, BLOCK
  Movement: CIRCLE L, CIRCLE R

BEGINNER (default):
  Punches: 1, 2, 3, 4
  Defense: SLIP L/R, ROLL L/R
```

```text
Resolution order:
1. Check prompt for explicit difficulty keywords (advanced, beginner, etc.)
2. Parse combos from prompt -> classify difficulty from combo content
3. Take the HIGHER of steps 1 and 2
4. If neither found, fall back to user's prestige tier
5. Apply history-based adjustments if available
```

