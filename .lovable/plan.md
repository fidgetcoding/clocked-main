

# Fix Level-Up Overlay Color Bleed + Louder Sound Effect

## Problem 1: Browser UI color bleed

The overlay uses `fixed inset-0` which covers the viewport, but the volt-colored background is bleeding into the browser's theme color area (status bar / address bar). The animation ends at `opacity: 0`, but the div itself stays in the DOM until `onComplete` fires at 2500ms -- the animation also takes 2500ms, so there's a tight race. If the animation finishes a hair early, the full-opacity volt div briefly shows unmasked.

**Fix:** Force the overlay container to hide itself with `opacity: 0` at animation end by adding an inline style that applies `animation-fill-mode: forwards` on the *parent* div as well, and also set `background: transparent` on the parent. Additionally, add `overflow: hidden` to the overlay container to prevent any color from extending into browser chrome regions. The meta theme-color tag (if present) could also cause this -- will check `index.html`.

## Problem 2: Level-up sound is too quiet/short

The current sound uses `triangle` wave oscillators at gain `0.15` with very short note lengths (0.12s each, overlapping). The final sustained chord is at gain `0.08`. This is barely audible, especially on phone speakers.

**Fix:** Make the sound significantly more impactful:
- Increase gain from `0.15` to `0.35` for the arpeggio notes
- Increase final chord gain from `0.08` to `0.25`
- Slow down the arpeggio (longer notes, less overlap) so it feels more dramatic
- Add a low sub-bass hit at the start for impact
- Use `sawtooth` wave type blended with `sine` for a richer tone
- Make the sustained chord ring longer (1 second instead of 0.5s)

These changes apply to both the hook version (`playLevelUpSound`) and the standalone `playSoundEffect.levelUp()`.

## Files to Change

1. **`src/components/ui/LevelUpOverlay.tsx`** -- Add `overflow: hidden` and ensure the parent div also fades out properly so no color leaks beyond the viewport into browser chrome.

2. **`src/index.css`** -- No changes needed (animation is correct at 100% opacity).

3. **`src/hooks/useSoundEffects.ts`** -- Rewrite both the hook `playLevelUpSound` callback and the standalone `playSoundEffect.levelUp()` with louder, more dramatic sound synthesis (higher gain, sub-bass hit, longer sustain, richer waveforms).

4. **`index.html`** -- Check for `theme-color` meta tag that might be getting tinted by the overlay.

