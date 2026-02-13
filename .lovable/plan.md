

## Remove Ranking Label from Vertical XP Bar

Remove the "PROSPECT" (ranking name) text that appears below the level number in the `VerticalXPBar` component.

### Technical Details

**File: `src/components/ui/VerticalXPBar.tsx`**

Remove the ranking name `<span>` elements in both render paths:

1. **L100 (max level) path** (~lines 68-70): Remove the `RANKING_NAMES[ranking]` span
2. **Normal level path** (~lines 90-92): Remove the `RANKING_NAMES[ranking]` span

This also allows removing the `getRankingFromLevel` import and usage since it will no longer be needed in this component.

