import type { ReactNode } from 'react';
import { LitNumber } from '../LitNumber';
import { BellPlate, StageHeadline } from './headlines';
import { ClockFace, ComboPlates, CuePlate, FreestylePlate, NextComboRow, PunchCount, PunchStats, SegmentTitle, TimeAdjust } from './parts';
import type { RunStageProps } from './types';
import type { FreeSide } from './useFreeSide';

type Props = RunStageProps & { bellXP: number | null; free: FreeSide; banner?: ReactNode };

/** Clock, combo and count in one panel, standing clear of the fighter. The combo is a plain display: nothing here reacts to the punch thrown. */
export function FreeSidePanel({ view, actions, feed, counting, bellXP, liveLog, free, banner }: Props) {
  const hasCombo = view.combo.length > 0;
  return (
    <section className="free-panel" data-testid="free-panel" data-mode={free.mode} data-side={free.side} data-edge={free.edge}>
      {banner}
      <div className="free-head flex flex-wrap items-center gap-x-3 gap-y-1">
        <StageHeadline view={view} bleed={false} className="!h-8 !text-[1.375rem]" />
        <SegmentTitle view={view} />
        <span className="lab lab-w ml-auto whitespace-nowrap">
          Elapsed <LitNumber value={view.elapsed} className="lit-inline" />
          <span data-testid="run-elapsed" className="sr-only">{view.elapsed}</span>
        </span>
        {bellXP != null && <BellPlate view={view} xp={bellXP} className="w-full" />}
        {feed?.cue && <CuePlate cue={feed.cue} className="w-full" textClass="text-[2.75rem] whitespace-normal" />}
      </div>
      <ClockFace view={view} className="free-clock" />
      {view.paused && <TimeAdjust onAdjust={actions.onAdjust} className="text-lg" />}
      {hasCombo ? (
        <div className="free-combo flex flex-col">
          {view.comboLabel && <span className="lab lab-lime shrink-0">{view.comboLabel}</span>}
          <ComboPlates moves={view.combo} className="mt-1 min-h-0 flex-1" />
          <NextComboRow view={view} className="shrink-0" />
        </div>
      ) : view.kind === 'freestyle' ? (
        <div className="free-combo">
          <FreestylePlate />
        </div>
      ) : view.upNext ? (
        <p className="fx text-3xl">Next: {view.upNext}</p>
      ) : null}
      <div className="free-count min-w-0">
        <PunchCount feed={feed} counting={counting} size="text-[3rem]" />
        {liveLog ? <div className="mt-1">{liveLog}</div> : <PunchStats feed={feed} className="mt-1 [@media(max-height:620px)]:hidden" />}
      </div>
    </section>
  );
}
