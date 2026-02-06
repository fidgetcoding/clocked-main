

# Background-Safe Workout Timer

## The Problem
Right now, the timer counts by incrementing +1 each second via `setInterval`. When you switch tabs or leave the app, browsers throttle or pause intervals, so the timer freezes and falls behind real time.

## The Solution
Switch from tick-counting to **wall-clock time tracking**. Instead of adding +1 each tick, we record *when* the timer started and calculate elapsed time from `Date.now()`. When you return to the app after 30 seconds away, it instantly catches up.

## How It Works

1. **Track timestamps instead of ticks** -- Store a `lastTickTime` ref that records the real-world timestamp of each interval tick
2. **On each tick, calculate the actual elapsed delta** -- Instead of assuming 1 second passed, compute `(Date.now() - lastTickTime) / 1000` to get the real seconds that passed (could be 1s, or 30s if backgrounded)
3. **Fast-forward through segments** -- If the delta is large (e.g., 30 seconds while backgrounded), loop through segment transitions so the timer catches up to the correct position
4. **XP accumulates correctly** -- XP is calculated based on actual elapsed seconds, not just tick count

## Technical Details

**File: `src/pages/WorkoutSession.tsx`**

- Add a `useRef` for `lastTickTimeRef` to track the last real-world timestamp
- Modify the main timer `useEffect` (around line 237):
  - On each interval tick, compute `delta = Math.floor((Date.now() - lastTickTimeRef) / 1000)`
  - Process multiple seconds at once if delta > 1 (background catch-up)
  - For each elapsed second: decrement `timeRemaining`, increment `totalElapsed`, accumulate XP
  - Handle segment transitions if `timeRemaining` drops to/below 0 during catch-up
  - Update `lastTickTimeRef` after processing
- Set `lastTickTimeRef = Date.now()` when starting/resuming the timer
- Add a `visibilitychange` listener to immediately process elapsed time when the tab becomes visible again (for instant catch-up without waiting for the next interval tick)

No database changes or new dependencies needed.
