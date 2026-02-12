
# Fix: Phantom Combo Generation and Suggested Count

## Problem

Two related issues:

1. **Phantom combo #6 (2-2)**: The speed bag block text "2 rounds speed bag, 2 minutes each, 30 sec rest." triggers the `containsComboNotation` fallback in `parseCombosFromBlock`. The regex `\b[1-8]\b` matches the "2" in "2 rounds", so `parseComboString` processes the entire block and picks up both "2"s (from "2 rounds" and "2 minutes") as punches, creating a fake combo `["2", "2"]`.

2. **"3 combos suggested" label**: The `countComboSegments` function in Build.tsx counts every phase that has a combo or shadowboxing segment. Speed Bag is labeled "Combo Work" (combo segment type) contributing x2, warmup shadowboxing contributes x1, and cooldown shadowbox contributes x1. Total "required" = 9 vs 6 combos = "3 suggested". This is misleading because speed bag and cooldown don't actually need combos.

## Fix 1: Remove the aggressive `containsComboNotation` fallback in `parseCombosFromBlock`

**File:** `src/lib/aiWorkoutParser.ts`

The fallback at lines 345-353 parses the entire block text as a combo string when `containsComboNotation` returns true but no structured combos were found. This is too aggressive -- any block containing a single digit 1-8 (like "2 rounds") triggers it. 

**Change:** Remove the fallback entirely. If `roundComboPattern` and `extractCombosFromPrompt` both find nothing, the block genuinely has no combos. The fallback was designed for very short prompts like "1-2-3" typed alone, but `extractCombosFromPrompt`'s dash pattern already handles that case.

## Fix 2: Only count phases that genuinely use combos in the "suggested" label

**File:** `src/pages/Build.tsx`

In `countComboSegments`, skip phases whose activity clearly doesn't use combos (speed bag, bodyweight, stretching, etc.). The simplest approach: only count phases where the segment type is explicitly `'combo'`, not `'shadowboxing'` or generic `'work'`. Or alternatively, only count grind-section phases that have `segmentType === 'combo'`.

Actually, the cleaner fix: change the segment type for Speed Bag from `'combo'` to `'work'` in the parser. In `blockToPhase`, the segment is labeled "Combo Work" with type `'combo'` because `block.combos.length > 0` (due to the phantom combo). Once Fix 1 removes the phantom combo, Speed Bag will have 0 combos, so `hasCombos` will be false, and the segment will correctly be named "Speed Bag" with type `'work'`. This fixes both issues at once.

## Summary

Only one code change is needed:

- **`src/lib/aiWorkoutParser.ts`**: Remove the `containsComboNotation` fallback block (lines 345-353) from `parseCombosFromBlock`

This single change:
- Prevents phantom combos from being generated from non-combo text
- Causes Speed Bag and Bodyweight blocks to correctly show their activity name instead of "Combo Work"
- Fixes the "suggested combos" count since those phases will no longer have combo segment types

## Technical Details

```text
BEFORE (parseCombosFromBlock):
  roundComboPattern → 0 matches
  extractCombosFromPrompt → 0 matches
  containsComboNotation("2 rounds speed bag, 2 minutes...") → TRUE (matches \b2\b)
  parseComboString(entire block) → ["2", "2"] ← PHANTOM COMBO

AFTER:
  roundComboPattern → 0 matches
  extractCombosFromPrompt → 0 matches
  return [] ← correct, no combos in speed bag block
```
