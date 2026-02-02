
# Plan: Add Incoming Combos and Next Workout to Rest Screen

## Overview
Enhance the rest screen to display the upcoming segment information and incoming combos, matching the visual style already used in the shadowboxing screen. This will help users prepare mentally for what's coming next while resting.

## Current Behavior
- Rest screen only shows the timer and basic segment info
- No combo preview during rest periods
- Users have to wait until the active segment starts to see what's coming

## Proposed Changes

### File: `src/pages/WorkoutSession.tsx`

**1. Calculate rest-specific combo data**

Add logic to determine if the NEXT segment after rest is a combo drill, and if so, get that combo for display:

```typescript
// After the existing isShadowboxing/displayCombo logic (around line 467)
const isRestSegment = currentSegment?.type === 'rest' && !isPreparation;

// For rest segments, check if next segment has a combo to preview
const nextSegmentIsCombo = nextSegment?.segmentType === 'combo' || 
                           nextSegment?.name.toLowerCase().includes('combo');
const nextSegmentIsShadowboxing = nextSegment?.segmentType === 'shadowboxing' ||
                                   nextSegment?.name.toLowerCase().includes('shadow') ||
                                   nextSegment?.name.toLowerCase().includes('technique');
const restComboPreview = nextSegment?.combo; // The combo for the upcoming segment
```

**2. Add the Rest Preview UI Component**

Insert a new UI section that appears only during rest periods (after the time modification buttons, around line 574):

```tsx
{/* Rest Screen - Next Segment Preview */}
{isRestSegment && (
  <div className="w-full max-w-sm space-y-4">
    {/* Next Segment Card */}
    <div className="bg-surface-2 rounded-xl p-4 border border-surface-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 text-center">
        UP NEXT
      </p>
      <p className="text-xl font-black text-foreground text-center uppercase">
        {nextSegment?.name || 'FINISH'}
      </p>
      {nextSegment?.duration && (
        <p className="text-sm text-muted-foreground text-center mt-1">
          {formatTime(nextSegment.duration)}
        </p>
      )}
    </div>
    
    {/* Incoming Combo Preview (if next segment is combo) */}
    {restComboPreview && restComboPreview.length > 0 && (
      <div className="bg-surface-1 rounded-xl p-4 border border-surface-3">
        <p className="text-xs text-alert-red font-bold mb-3 text-center animate-pulse">
          INCOMING COMBO
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {/* Same combo display logic as shadowboxing screen */}
        </div>
      </div>
    )}
  </div>
)}
```

**3. Reuse Combo Display Logic**

Extract the combo move conversion into a reusable helper function to avoid code duplication:

```typescript
// Helper function to convert move names to display format
function getDisplayMove(move: string): { display: string; type: 'punch' | 'defense' | 'movement' } {
  const m = move.toUpperCase();
  // Punch conversions
  if (m === 'JAB') return { display: '1', type: 'punch' };
  if (m === 'CROSS' || m === 'STRAIGHT') return { display: '2', type: 'punch' };
  // ... rest of conversions
  // Defense conversions
  if (m.includes('SLIP L')) return { display: 'SL', type: 'defense' };
  // ... etc
  return { display: move, type: 'punch' };
}
```

## Visual Design

The rest screen will display:

```
+----------------------------------+
|           REST                   |
|           1:30                   |
|          ── REST ──              |
|                                  |
|      [50%]        [2X]           |
|   [-30] [-15] [+15] [+30]        |
|                                  |
|   ┌─────────────────────────┐    |
|   │       UP NEXT           │    |
|   │    COMBO DRILL          │    |
|   │        0:45             │    |
|   └─────────────────────────┘    |
|                                  |
|   ┌─────────────────────────┐    |
|   │    INCOMING COMBO       │    | (flashing red)
|   │   1 > 2 > SL > 3 > 2    │    |
|   └─────────────────────────┘    |
|                                  |
+----------------------------------+
```

## Technical Details

- Uses existing `nextSegment` data already available in the component
- Matches the visual styling of the shadowboxing "INCOMING COMBO" section
- The combo preview only shows when the next segment is a combo drill
- If next segment is shadowboxing or has no combo, just shows "UP NEXT" with segment name
- Reuses the same color coding (volt for punches, yellow for defense, blue for movement)

## Edge Cases Handled

1. **No next segment**: Shows "FINISH" when rest is the last segment
2. **No combo in next segment**: Only shows the "UP NEXT" card without combo preview
3. **Preparation phase**: Rest preview doesn't show during the initial countdown
