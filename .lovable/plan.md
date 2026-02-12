

# Speed Bag Category + Per-Phase Combos

## Overview

Three interconnected changes to improve the workout builder's segment classification and combo organization.

---

## 1. New "Speed Bag" Segment Type

Add a new `speedbag` segment type with its own badge and color, distinct from both Shadowboxing (S) and Combo (C).

- **Badge**: "SB" (to avoid collision with Shadowboxing's "S")
- **Color**: A unique accent -- orange/amber (`bg-orange-500/20 text-orange-400`) to differentiate from volt-green combo and shadowboxing badges
- Speed bag segments default to freestyle (no combo assignment) unless combos are explicitly added to its phase
- The AI parser will detect "speed bag" in prompts and assign `segmentType: 'speedbag'` instead of `'combo'`

### Files changed:
- **`src/types/index.ts`**: Add `'speedbag'` to the `SegmentType` union
- **`src/pages/Build.tsx`**: Add `speedbag` entry to `SEGMENT_TYPES` array and include it in the segment type cycle
- **`src/lib/aiWorkoutParser.ts`**: Update `inferSegmentType` to detect "speed bag" and return `'speedbag'`
- **`src/pages/WorkoutSession.tsx`**: 
  - Exclude `speedbag` segments from combo assignment (they default to freestyle)
  - Show FREESTYLE label for `speedbag` segments (same as combo segments without combos)

---

## 2. Move Combos from Global List to Per-Phase

Currently, combos live at the workout level (`workout.combos: string[][]`) and are shared across all phases. The new model stores combos on each phase (`phase.combos: string[][]`), so different phases (Heavy Bag vs Speed Bag) can have independent combo lists.

### Data model change:
- **`src/types/index.ts`**: Add `combos?: string[][]` to the `WorkoutPhase` interface
- The top-level `workout.combos` stays for backward compatibility but phases with their own combos take priority

### Builder UI change (`src/pages/Build.tsx`):
- **Remove** the global "Combos" section at the bottom of the Rounds tab (lines 624-668)
- **Add** an inline combo list below each combo-type segment within a phase:
  - Shows the phase's combo list (add, edit, delete, reorder)
  - The "+ Add" button opens the same combo builder modal, but saves to the phase's combos
  - Each phase manages its own independent combo list
  - Only visible for phases containing combo or shadowboxing segments

### Timer/session change (`src/pages/WorkoutSession.tsx`):
- Update `getComboListForPhase` to read from `phase.combos` first, falling back to `workout.combos` for backward compatibility
- Speed bag phases are excluded from combo assignment entirely (always freestyle)

### Save/Load changes:
- **`dbPhasesToLocal`** in Build.tsx already preserves phase data -- combos on each phase will serialize naturally since phases are stored as JSONB
- No database migration needed -- the `phases` JSONB column already stores arbitrary phase properties

### AI Builder changes (`src/lib/aiWorkoutParser.ts` + `src/components/AIBuilderModal.tsx`):
- When generating combos, attach them to the relevant phase's `combos` array instead of the workout-level array
- Legacy `generateWorkoutFromPrompt` fallback also attaches combos per-phase

---

## 3. Migration / Backward Compatibility

- Existing workouts with top-level `combos` will continue to work: the timer reads `phase.combos` first, then falls back to `workout.combos`
- When a user edits an old workout, the builder will migrate top-level combos into the first grind phase that has combo segments, so they appear inline
- New workouts always store combos per-phase

---

## Technical Summary

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `'speedbag'` to SegmentType; add `combos?: string[][]` to WorkoutPhase |
| `src/pages/Build.tsx` | Add SB segment type; remove global combos section; add inline per-phase combo list below combo segments |
| `src/pages/WorkoutSession.tsx` | Read phase-level combos; exclude speedbag from combo assignment; show FREESTYLE for speedbag |
| `src/lib/aiWorkoutParser.ts` | Detect speed bag; assign combos per-phase; return `'speedbag'` segment type |
| `src/components/AIBuilderModal.tsx` | Attach generated combos to phases instead of workout-level |
| `src/data/comboPresets.ts` | No changes needed |

