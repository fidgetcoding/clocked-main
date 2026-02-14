

## Fix: Restore Two-Layer Layout

The last edit broke things by removing the closing tag for the centered timer container (Layer 1) and merging the combo cards into it. This made the cards part of the vertically-centered flex group, shifting the timer's position.

### What went wrong

The timer group (Layer 1) is wrapped in an `absolute inset-0 flex justify-center` container. Previously, the combo cards were in a separate absolute container (Layer 2). The last edit deleted the Layer 1 closing `</div>` and placed the combo cards inside Layer 1, making them affect the centering calculation.

### The fix (single surgical edit)

1. **Re-close Layer 1** after the time adjustment buttons (after line 1221) by adding back the `</div>` that was removed.

2. **Wrap the combo/UP NEXT cards** in a restored Layer 2 container that is absolutely positioned and does NOT affect Layer 1. This container will sit in the lower portion of the middle area, directly below where the time buttons end.

### Exact structure after fix

```text
<div className="flex-1 relative px-4">        <!-- Middle area -->

  <!-- Layer 1: absolute inset-0, flex centered -->
  <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
    Phase Name
    Timer Circle + XP Bar
    Segment Name
    Time Buttons (-30s, -15s, +15s, +30s)
  </div>   <!-- Layer 1 CLOSED here — nothing else inside -->

  <!-- Layer 2: absolute, bottom half only, pointer-events-none wrapper -->
  <div className="absolute left-4 right-4 flex flex-col items-center justify-start pointer-events-none"
       style={{ top: '62%', bottom: '0' }}>
    <div className="pointer-events-auto">
      Combo Card / UP NEXT Card / Freestyle
    </div>
  </div>   <!-- Layer 2 CLOSED -->

</div>     <!-- Middle area CLOSED -->
```

### Why this works

- Layer 1 is self-contained. Its `justify-center` calculation only includes phase name, timer, segment label, and time buttons. Adding or removing cards has zero effect.
- Layer 2 is a completely separate absolute container. It starts at roughly 62% from the top (just below the time buttons) and extends to the bottom of the middle area. Cards render at the top of this zone — directly below the time buttons — via `justify-start`.
- `pointer-events-none` on the wrapper prevents it from blocking clicks on Layer 1; `pointer-events-auto` on the inner card restores interactivity for the cards themselves.

### What does NOT change

- The timer circle position — untouched
- The XP bar — untouched
- The phase/segment text — untouched
- The time adjustment buttons — untouched
- Any card content or styling — untouched

### Files modified

- `src/pages/WorkoutSession.tsx` — one edit: re-insert Layer 1 closing div at line 1221, wrap lines 1223-1353 in a new absolute Layer 2 container.

