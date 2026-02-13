

## Remove "2x XP" Badge from Championship Rounds Banner

### Change

**File: `src/pages/WorkoutSession.tsx` (line 1119)**

Remove the `<span>` element that displays "2x XP" from the Championship Rounds banner. The banner will keep the two lightning bolt icons and the "Championship Rounds" text.

**Before:**
```
<Zap /> CHAMPIONSHIP ROUNDS [2× XP] <Zap />
```

**After:**
```
<Zap /> CHAMPIONSHIP ROUNDS <Zap />
```

This is a single line deletion -- no other files are affected.

