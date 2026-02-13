

## Fix: Make the 270-degree Arc Pulse Visibly During Countdown

### Problem
1. The glow circle uses Tailwind's default `pulse` keyframe which oscillates CSS opacity between 1 and 0.5. Combined with the SVG `opacity="0.3"` attribute, the actual visible range is only 0.15-0.3 -- nearly invisible.
2. The arc has no CSS transition on its stroke properties, so the countdown appears to "jump" rather than smoothly animate.

### Solution

**File: `src/pages/WorkoutSession.tsx` (lines 1152-1154)**

1. Remove the inline `opacity="0.3"` from the glow circle and instead drive the pulse entirely through a CSS animation with a more visible opacity range (e.g., 0.2 to 0.6).
2. Add a CSS `transition` style to the filled arc circles so `strokeDasharray` interpolates smoothly as `timeRemaining` ticks down.

**File: `tailwind.config.ts`**

Add a new keyframe `arc-glow-pulse` that animates opacity between 0.2 and 0.6 (visible range):

```
"arc-glow-pulse": {
  "0%, 100%": { opacity: "0.2" },
  "50%": { opacity: "0.55" },
}
```

And register the animation:
```
"arc-glow-pulse": "arc-glow-pulse 2s ease-in-out infinite"
```

### Changes

**tailwind.config.ts** -- add `arc-glow-pulse` keyframe and animation entry.

**src/pages/WorkoutSession.tsx** (lines 1152-1154):
- Glow circle (line 1153): Remove `opacity="0.3"`, replace `className="animate-[pulse_2s_ease-in-out_infinite]"` with `className="animate-arc-glow-pulse"`.
- Both filled circles (lines 1153-1154): Add `style={{ transition: 'stroke-dasharray 0.3s linear' }}` so the arc animates smoothly each tick.

