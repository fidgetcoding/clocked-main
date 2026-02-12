

## Fix: Total Time Display Format

Update the time formatting in `src/pages/Profile.tsx` to show combined hours and minutes once past 1 hour.

**Logic:**
- Under 1 hour: show `Xm` (e.g., "59m")
- Exactly 1 hour: show `1h` 
- Over 1 hour with remaining minutes: show `Xh Ym` (e.g., "1h 1m", "2h 30m")

**Changes in `src/pages/Profile.tsx`:**

Update the Total Time stat card (around line 266) and the existing `formatDuration` helper (line 19) is already written correctly for this -- reuse it in the stat card instead of inline logic.

The existing `formatDuration` function at the top of the file already does exactly what you want:
```
if (hours > 0) return `${hours}h ${mins}m`
return `${mins}m`
```

So the fix is simply replacing the inline formatting in the stat card with a call to `formatDuration(totalTrainingSeconds)`.

