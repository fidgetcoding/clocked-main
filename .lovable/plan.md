
# Plan: Add Workout Section Header to Timer

## Overview
Add a header above the timer that displays which phase of the workout the user is currently in: WARM-UP, ROUNDS, or COOL DOWN. This gives users better context about their position in the overall workout structure.

## Current State
- The timer screen shows the segment name (e.g., "SHADOWBOXING", "COMBO DRILL")
- The segment type is shown below the timer (e.g., "REST", "WORK")
- No indication of which major section the user is in

## Proposed Change

### File: `src/pages/WorkoutSession.tsx`

Add a section indicator above the phase title (around line 560):

**Location**: Between the `<div className="flex-1 flex flex-col...">` and the existing Phase Title `<h2>`

**New UI Element**:
```tsx
{/* Section Indicator */}
{!isPreparation && currentSegment?.section && (
  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
    {currentSegment.section === 'warmup' ? 'WARM-UP' : 
     currentSegment.section === 'grind' ? 'ROUNDS' : 
     'COOL DOWN'}
  </p>
)}
```

## Visual Result

**Before:**
```
      SHADOWBOXING        <- Segment name
         1:30            <- Timer
      ── WORK ──         <- Segment type
```

**After:**
```
       WARM-UP           <- Section indicator (new)
      SHADOWBOXING        <- Segment name  
         1:30            <- Timer
      ── WORK ──         <- Segment type
```

## Technical Details

- Uses existing `currentSegment.section` property which is already available (`'warmup' | 'grind' | 'cooldown'`)
- Maps technical names to user-friendly labels:
  - `warmup` → "WARM-UP"
  - `grind` → "ROUNDS"
  - `cooldown` → "COOL DOWN"
- Hidden during the preparation countdown phase
- Subtle styling (small, muted text) to not compete with the main timer
