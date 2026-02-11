

# Level-Up Overlay: 100% Opacity

## Change

One small CSS update in `src/index.css` -- change the `level-up-flash` keyframe opacity values from `0.95`/`0.9` to `1.0`:

```css
@keyframes level-up-flash {
  0% { opacity: 0; }
  8% { opacity: 1; }
  40% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; }
}
```

## Level-Up Logic Verification

The celebration **does work correctly** during real gameplay. Here's how:

1. As the timer runs, XP accumulates each tick based on the activity type and streak multiplier
2. A "live level" is recalculated every tick using `getLevelFromXP(prestige, totalXP + accumulatedXP)`
3. When the live level exceeds the previous level, the overlay fires showing the **correct new level number**
4. The level-up sound plays simultaneously
5. After 2.5 seconds the overlay auto-dismisses

This works identically in both the structured Workout Session timer and the Quick Session timer. The level displayed in the celebration is always the level you just reached.

