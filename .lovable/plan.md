

# Contextual Segment Labels + Freestyle Indicator

## Two Changes

### 1. Parser: Use activity name instead of "Combo Work" (aiWorkoutParser.ts)

In `blockToPhase()`, line 417, change the segment name from the generic "Combo Work" to the block's activity name. The activity name comes from what the user typed (e.g., "Heavy Bag Work", "Speed Bag").

```
// Line 417, change:
name: hasCombos ? 'Combo Work' : block.activityName,
// To:
name: block.activityName,
```

The segment type (`segmentType: 'combo'`) and badge ("C") remain unchanged -- those still correctly indicate combo behavior internally. Only the display name changes.

### 2. Timer: Show FREESTYLE for work segments without combos (WorkoutSession.tsx)

Currently, the combo display area for non-shadowboxing segments (line 1001-1051) only renders when `displayCombo` has content. Speed Bag segments have no combo assigned, so nothing shows -- the user has no indication of what to do.

Add a FREESTYLE display for active non-shadowboxing, non-rest segments that have no combo assigned. This goes right after the existing combo display block (after line 1051):

```typescript
{/* Freestyle Display - for work segments with no combos */}
{!isShadowboxing && !isPreparation && currentSegment?.type === 'active' && 
 (!displayCombo || displayCombo.length === 0) && (
  <div className="w-full max-w-sm bg-surface-1 rounded-xl p-4 border border-surface-3">
    <p className="text-2xl font-black text-volt text-center">FREESTYLE</p>
  </div>
)}
```

This means:
- Heavy Bag rounds with combos assigned: shows the specific combo (1-2, 1-1-2-3, etc.)
- Speed Bag rounds with NO combos: shows FREESTYLE
- Shadowboxing with no incoming combo: already shows FREESTYLE (existing behavior, unchanged)
- Rest segments: no combo display (unchanged)

### Files Changed

1. **`src/lib/aiWorkoutParser.ts`** (line 417) -- one-line change to segment naming
2. **`src/pages/WorkoutSession.tsx`** (after line 1051) -- add FREESTYLE block for non-shadowboxing work segments without combos

