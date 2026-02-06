
# Enhanced AI Workout Builder - Framework Integration

## Overview
Upgrade the AI workout parser with the Clombo Framework rules while maintaining 100% backward compatibility with existing workout structures and timer engine.

## Current State Analysis
The existing system works but has limitations:
- Simple regex matching for rounds, duration, difficulty
- Hardcoded combo generation based on focus keywords
- No support for user-specified combos (e.g., "1-2-slip-3")
- Cannot parse specific round/rest durations (e.g., "3 min rounds, 1 min rest")
- No superset/workout loop support
- No exercise integration between rounds

## Key Principle: Enhancement, Not Replacement
- All existing functionality remains intact
- New parsing runs FIRST; falls back to existing logic if parsing doesn't extract specific values
- Timer engine requires NO changes - we output the same structure it already consumes
- Database schema requires NO changes - phases/combos already support needed data

---

## Files to Create

### 1. `src/lib/aiWorkoutParser.ts` (NEW)
Central parsing logic implementing framework rules:

```text
EXPORTS:
- parseWorkoutInput(prompt: string, userLevel: string) → ParsedWorkout
- parseComboString(input: string) → string[]
- detectTags(prompt: string) → string[]
- inferPhaseType(description: string) → 'continuous' | 'circuit' | 'rest'

CONSTANTS:
- DEFAULT_DURATIONS (boxing round: 180s, rest: 60s, warmup: 300s, etc.)
- PUNCH_MAP ({ jab: '1', cross: '2', hook: '3', ... })
- KEYWORD_TAGS ({ boxing: [...], strength: [...], cardio: [...] })
```

### 2. `src/lib/comboParser.ts` (NEW)
Dedicated combo string parsing:

```text
FUNCTION parseComboString(input: string): string[]
- Split on spaces, dashes, commas
- Map punch names to numbers: "jab" → "1", "cross" → "2", etc.
- Normalize defense moves: "slip" → "SLIP L" (default left)
- Handle "double jab" → ["1", "1"]
- Handle compound notation: "1-2-slip-3" → ["1", "2", "SLIP L", "3"]
```

---

## Files to Modify

### 3. `src/components/AIBuilderModal.tsx`

**Keep existing functions as fallbacks:**
- `parseWorkoutPrompt()` stays - used when advanced parser doesn't find specifics
- `generateWorkoutFromPrompt()` enhanced to use new parser first

**New parsing flow:**
```text
1. Try advanced parsing with new parser
2. Extract: specific combos, round/rest durations, phase structure, superset
3. For anything NOT specified, fall back to existing defaults
4. Generate Workout object (same structure timer expects)
```

**New capabilities added:**
- Parse "3 min rounds with 1 min rest" → roundDuration: 180, restDuration: 60
- Parse "1-2-slip-3" → combo: ["1", "2", "SLIP L", "3"]
- Parse "do it twice" → workout with supersetRepeats: 2
- Parse "10 pushups between rounds" → adds pushup segment to circuit
- Auto-tag based on keywords

**Clarification logic:**
If prompt is too vague (< 15 characters or missing key info), show inline hints:
- "Tip: Try specifying number of rounds (e.g., '5 rounds')"
- NOT a blocking modal - just helpful suggestions

### 4. `src/types/index.ts`

**Add optional fields (backward compatible):**
```typescript
interface WorkoutPhase {
  // ... existing fields
  phaseType?: 'continuous' | 'circuit' | 'rest';  // NEW - display hint only
}

interface WorkoutSegment {
  // ... existing fields
  exercise?: string;  // NEW - for custom exercises like "Burpees"
  activityType?: 'combos' | 'shadowbox' | 'run' | 'pushups' | 'custom';  // NEW
}

interface Workout {
  // ... existing fields
  supersetRepeats?: number;  // NEW - default 1
  tags?: string[];  // Already exists in DB, add to type
}
```

---

## Parsing Rules Implementation

### Duration Extraction
```text
Pattern: "(\d+)\s*(min|minute|sec|second)s?\s*(round|work|on)"
→ Extracts work duration

Pattern: "(\d+)\s*(min|minute|sec|second)s?\s*(rest|off|break)"
→ Extracts rest duration

Default fallbacks (from framework):
- Boxing round: 180s
- Boxing rest: 60s
- Warmup: 300s (if no duration specified)
- Cooldown: 300s
- Strength segment: 30s
- Sprint: 30s
```

### Combo Parsing
```text
Input: "1-2-slip-3"
Process:
1. Split: ["1", "2", "slip", "3"]
2. Normalize: ["1", "2", "SLIP L", "3"]
Output: ["1", "2", "SLIP L", "3"]

Input: "jab cross hook"
Process:
1. Split: ["jab", "cross", "hook"]
2. Map: ["1", "2", "3"]
Output: ["1", "2", "3"]

Input: "double jab cross"
Process:
1. Detect "double" modifier
2. Map: ["1", "1", "2"]
Output: ["1", "1", "2"]
```

### Phase Structure Detection
```text
"warmup" → continuous phase, repeats: 1
"X rounds of..." → circuit phase, repeats: X
"then Y rounds..." → additional circuit phase
"cooldown" → continuous phase, repeats: 1
"rest between phases" → rest phase
```

### Superset Detection
```text
"do the whole thing twice" → supersetRepeats: 2
"repeat everything" → supersetRepeats: 2
"run it back" → supersetRepeats: 2
"X supersets" → supersetRepeats: X
```

---

## Timer Engine Compatibility

The timer in `WorkoutSession.tsx` consumes this structure:
```typescript
{
  sections: { warmup: Phase[], grind: Phase[], cooldown: Phase[] },
  combos: string[][]
}
```

**What we output (unchanged):**
- Phases go into appropriate section based on phaseType
- Circuit phases with repeats > 1 → timer loops segments
- Combos array at workout level → timer cycles through
- All existing segment fields preserved

**No timer changes needed because:**
- Timer already handles `phase.repeats` for looping
- Timer already handles `segment.combo` for display
- Timer already handles `segment.segmentType` for activity detection
- New optional fields are ignored if not used

---

## Backward Compatibility Checklist

| Feature | Current Behavior | After Enhancement |
|---------|-----------------|-------------------|
| Simple "5 round boxing" | Works | Works (same output) |
| "20 min HIIT" | Works | Works (same output) |
| Focus keywords (defense, footwork) | Works | Works (enhanced) |
| Difficulty detection | Works | Works |
| Generated combos | Hardcoded arrays | User-specified OR generated |
| Preset workouts | Untouched | Untouched |
| Timer execution | No changes | No changes |
| Database storage | No changes | No changes |
| Manual Build page | Untouched | Untouched |

---

## Implementation Order

1. **Create `src/lib/comboParser.ts`**
   - Pure utility, no side effects
   - Fully testable in isolation

2. **Create `src/lib/aiWorkoutParser.ts`**
   - Import comboParser
   - All parsing logic centralized
   - Uses existing type definitions

3. **Update `src/types/index.ts`**
   - Add optional fields only
   - No required field changes

4. **Update `src/components/AIBuilderModal.tsx`**
   - Import new parsers
   - Enhance `generateWorkoutFromPrompt()` to use new parser
   - Keep existing `parseWorkoutPrompt()` as fallback
   - Same output structure to Build page / timer

---

## Example: Before vs After

**Input:** "6 rounds of 1-2-slip-3 for 2 minutes with 30 second rest"

**Before (current):**
- Rounds: 6 ✓
- Duration: Calculated from "2 minutes" total = ~28s each ✗
- Combos: Auto-generated based on difficulty ✗
- Rest: Calculated as 30% of round ✗

**After (enhanced):**
- Rounds: 6 ✓
- Work duration: 120s (2 minutes) ✓
- Rest duration: 30s ✓
- Combos: [["1", "2", "SLIP L", "3"]] (parsed from input) ✓
- Tags: ["boxing"] ✓
