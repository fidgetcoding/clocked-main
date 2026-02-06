

# Quick Start Timer + Reorder Cleanup

## 1. Quick Start Timer

### Placement
A special **raised circular button** in the bottom nav bar, positioned between "MY STATS" and "FIGHT CLUB". It will pop up above the nav bar (like a floating action button) with a stopwatch/timer icon and a volt-colored glow. This keeps the home screen untouched while making Quick Start always accessible from any screen.

### XP Rate: 0.10 XP/sec
Here's how it compares to other activities:

```text
rest          0.01
stretching    0.05
QUICK START   0.10  <-- here
walking       0.12
planks        0.15
jogging       0.18
jump rope     0.20
pushups       0.22
running       0.25
shadowboxing  0.33
sparring      2.5+
```

Sitting just below walking -- fair reward for showing up without structure.

### Timer UI
The Quick Session page will mirror the existing workout timer layout but simplified:
- Same top bar layout (home/exit button left, elapsed time center, XP bar right)
- Main timer counts **up** instead of down (stopwatch style) in the same large volt font
- Label says "QUICK SESSION" where the segment name usually goes
- "FREEFORM" where segment type usually says "WORK" / "REST"
- Controls: Play/Pause and Finish (no skip, no back, no time modification)
- Same completion screen (notes, difficulty rating, log button)
- Background-safe wall-clock timing (same pattern already implemented)

### Logging
- Logged to `workout_history` with `workout_name: "Quick Session"`, `workout_id: null`
- Streak multiplier still applies

## 2. Reorder Button Cleanup
Replace the current `ArrowUpDown` icon + "Reorder" text with just a `GripVertical` icon (the classic drag-handle icon -- three pairs of dots). No text label, just the icon. It's universally recognized as "drag to reorder" and much more minimal.

## Technical Details

### New File: `src/pages/QuickSession.tsx`
- Stopwatch (count-up) timer using `Date.now()` wall-clock pattern
- Reuses `VerticalXPBar` component for live XP display
- XP rate constant: `0.10` per second (with streak multiplier from profile)
- On finish: completion screen with duration, XP earned, notes, difficulty, log button
- Logs via `useWorkoutHistory().addHistoryEntry`
- Updates profile XP via `useProfile().addXP`

### Edit: `src/components/layout/BottomNav.tsx`
- Add a center "Quick Start" button between MY STATS and FIGHT CLUB
- Styled as a raised circular button (larger than other nav items, volt background, slight negative top margin to float above the bar)
- Uses `Timer` or `Play` icon from lucide-react
- Navigates to `/quick-session`

### Edit: `src/App.tsx`
- Add route: `/quick-session` pointing to `QuickSession` component

### Edit: `src/pages/Index.tsx`
- Replace `ArrowUpDown` import with `GripVertical`
- Remove "Reorder" text label, keep icon-only button

### No database changes needed
- `workout_history` already supports `workout_id: null`
