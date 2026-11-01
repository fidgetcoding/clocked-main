import type { RunFlash, RunView } from './types';

export const isRest = (view: RunView) => view.kind === 'rest';

export function runTickerItems(view: RunView, feedCount?: number | null, flash?: RunFlash): (string | null | false)[] {
  return [
    flash?.badgeTally && `${flash.badgeTally.count} badge${flash.badgeTally.count !== 1 ? 's' : ''}, +${flash.badgeTally.xp.toLocaleString()} XP`,
    view.kind !== 'freeform' && `Up next ${view.upNext}`,
    view.nextCombo && `Next combo ${view.nextCombo}`,
    `Elapsed ${view.elapsed}`,
    view.segmentCount > 0 && `Segment ${Math.max(1, view.segmentIndex)} of ${view.segmentCount}`,
    feedCount != null && feedCount > 0 && `${feedCount} punches`,
    view.streak > 0 && `Streak ${view.streak}`,
    `Session XP ${view.sessionXP.toLocaleString()}`,
    view.xpToNext != null && `${view.xpToNext.toLocaleString()} XP to Lvl ${view.level + 1}`,
  ];
}
