

## Fix: Home Screen Action Card Proportions

The current approach of using a fixed `w-20` for Quick Start makes it too narrow, forcing tiny text. Instead, we'll use a cleaner proportional approach.

### The Change

Replace the flex layout with a **CSS grid using fractional units**: `grid-cols-[5fr_5fr_2fr]`. This gives Create and Workout Log each ~42% of the width, and Quick Start ~16% -- noticeably smaller but not so cramped that text gets clipped or needs a tiny font.

Quick Start will keep the same font size as the others (`text-base` for the main label) but use a shorter word: just "QUICK" with "START" below it, matching the two-line pattern of the other cards.

### Specific Changes (1 file)

**src/pages/Index.tsx** (lines 150-186):
- Change `<div className="flex gap-3">` to `<div className="grid grid-cols-[5fr_5fr_2fr] gap-3">`
- Remove `flex-1` from Create and Workout Log buttons
- Remove `w-20 shrink-0` from Quick Start button
- Restore Quick Start text to use `text-sm font-black` for "QUICK" and `text-xs` for "START" (matching the style of the other two cards but slightly smaller since the column is narrower)
- All three cards keep `h-36`, `card-action`, and centered flex layout

This keeps all three cards visually cohesive with readable text while making Quick Start clearly secondary in size.
