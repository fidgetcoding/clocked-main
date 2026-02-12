

# AI Builder Parser Overhaul: Multi-Phase Support

## Problem Summary

The current AI workout parser treats the entire prompt as a single block. It extracts one round count, one duration, and one rest value from the whole text, then builds exactly three sections: one hardcoded warmup, one grind phase, and one hardcoded cooldown. This causes every issue you reported:

- **Round count wrong** -- `parseRounds()` grabs the first "X rounds" match in the text (the warmup's "3 round"), ignoring the heavy bag's "5 rounds"
- **Durations wrong** -- `parseDurations()` grabs the first minute/second match, not the one associated with the correct block
- **Warmup/Cooldown hardcoded** -- The warmup always produces Jump Rope + Shadow Boxing at fixed durations regardless of what you specify
- **Speed Bag and Bodyweight phases dropped** -- The parser has no concept of multiple grind phases; it creates exactly one
- **Cooldown durations inconsistent** -- Light Shadow is hardcoded to 90 sec, Stretch to 120 sec, ignoring your input

## Solution: Block-Based Multi-Phase Parser

Rewrite the core of `src/lib/aiWorkoutParser.ts` to split the prompt into logical blocks first, then parse each block independently.

### Step 1: Block Splitter

Add a new function `splitIntoBlocks()` that segments the prompt by paragraph breaks and structural cues like:
- Line breaks / double newlines
- Sentences that start with round counts ("3 round warm up...", "5 rounds heavy bag...")
- Section keywords: "warm up", "cool down", numbered phase indicators

Each block becomes an independent parsing unit with its own round count, durations, segment names, and section assignment (warmup/grind/cooldown).

### Step 2: Per-Block Parsing

For each block, independently extract:
- **Round count**: from that block's text only
- **Work duration**: from that block's text only (converting minutes to seconds)
- **Rest duration**: from that block's text only
- **Activity names**: specific exercises mentioned (shadowbox, jump rope, dynamic stretches, speed bag, burpees, etc.)
- **Per-round assignments**: if the user says "First round X, Second round Y", create individual segments in the correct order
- **Section classification**: detect if the block is warmup, cooldown, or main work based on keywords

### Step 3: Per-Round Activity Parsing

When a block contains per-round descriptions ("First round shadowbox light. Second round jump rope."), parse each into a separate segment with:
- The correct name
- The duration from the block's header (e.g., "1 minute each" = 60 sec per segment)
- Rest segments inserted between them at the block's rest duration

### Step 4: Phase Assembly

Replace the current `buildPhases()` which creates one hardcoded warmup + one grind + one cooldown. Instead, convert each parsed block directly into a `ParsedPhase` with:
- Correct section assignment (warmup/grind/cooldown)
- Correct repeat count from block
- Correct segments from block
- Correct timing from block

Multiple grind blocks become multiple phases in the grind section.

### Step 5: Update `generateWorkoutFromPrompt()` in AIBuilderModal.tsx

The `hasSpecificData` check currently gates on `parsedRounds || parsedDurations || parsedCombos`. With multi-phase parsing, this should always use the new parser when blocks are detected. The legacy `parseWorkoutPrompt()` fallback remains for very simple/vague prompts.

## Files Changed

1. **`src/lib/aiWorkoutParser.ts`** -- Major rewrite of the parsing pipeline:
   - New `splitIntoBlocks()` function
   - New `parseBlock()` function for per-block extraction
   - New `parsePerRoundActivities()` for ordered segment creation
   - Updated `buildPhases()` to assemble from blocks instead of hardcoded templates
   - Updated `parseWorkoutInput()` to use block-based flow
   - Keep all existing helper functions (combo parsing, tag detection, etc.) intact

2. **`src/components/AIBuilderModal.tsx`** -- Minor update to `generateWorkoutFromPrompt()`:
   - Improve the `hasSpecificData` gate to detect multi-block prompts
   - No structural changes needed; the function already delegates to the parser

## Expected Results for the Test Prompt

After this change, the test prompt would produce:

- **Warmup section**: 1 phase, 3 repeats, segments: Shadowbox Light (60s), Jump Rope (60s), Dynamic Stretches (60s), with 30s rest between
- **Grind section - Phase 1**: "Heavy Bag Work", 5 repeats, Combo Work (180s) + Rest (60s), with 5 parsed combos
- **Grind section - Phase 2**: "Speed Bag", 2 repeats, Speed Bag (120s) + Rest (30s)
- **Grind section - Phase 3**: "Bodyweight Burnout", 3 repeats, with per-round exercises (90s each) + Rest (45s)
- **Cooldown section**: 1 phase, 2 repeats, Slow Shadowbox (120s), Static Stretching (120s), no rest

## Technical Details

```text
CURRENT FLOW:
  Prompt --> parseRounds (first match) --> parseDurations (first match) --> buildPhases (hardcoded template)
  Result: 1 warmup + 1 grind + 1 cooldown

NEW FLOW:
  Prompt --> splitIntoBlocks() --> [Block1, Block2, Block3, Block4, Block5]
                                      |        |        |        |        |
                                  parseBlock  parseBlock  ...   ...     ...
                                      |        |
                                  Phase(warmup) Phase(grind) Phase(grind) Phase(grind) Phase(cooldown)
```

