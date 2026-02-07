

# Move Quick Start from Bottom Nav to Home Screen

## What Changes

The raised Quick Start timer button will be removed from the bottom navigation bar and added as a third action card on the home screen, alongside "Create Set" and "Workout Log."

## Layout

The home screen action cards section will change from a 2-column grid to a 3-column grid:

```text
+-------------+-------------+-------------+
|   CREATE    |  WORKOUT    |   QUICK     |
|    SET      |    LOG      |   START     |
+-------------+-------------+-------------+
```

The Quick Start card will follow the same `card-action` styling as the other two cards, with a Timer icon and the same typography pattern (bold label + muted subtitle).

## Bottom Nav

The bottom nav simplifies to 4 equal items in a row:

```text
  HOME    MY STATS    FIGHT CLUB    PROFILE
```

No more raised center button, no gap in the middle -- just a clean, evenly spaced navigation bar.

## Technical Details

1. **`src/components/layout/BottomNav.tsx`** -- Remove the center Quick Start button and its container. Merge `leftNavItems` and `rightNavItems` into a single array rendered evenly.

2. **`src/pages/Index.tsx`** -- Change the action cards grid from `grid-cols-2` to `grid-cols-3` and add a third card for Quick Start (Timer icon, "QUICK" / "START" labels, navigates to `/quick-session`).

