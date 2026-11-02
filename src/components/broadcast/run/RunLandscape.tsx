import { cn } from '@/lib/utils';
import { LevelBar } from '../LevelBar';
import { SegmentBar } from '../SegmentBar';
import { BellPlate, StageHeadline } from './headlines';
import {
  AirLight,
  ClockFace,
  ComboPlates,
  CuePlate,
  FeedBanner,
  FlashLayer,
  FreestylePlate,
  NextComboRow,
  PunchCount,
  PunchStats,
  SegmentTitle,
  SessionTape,
  StageBug,
  TimeAdjust,
  ToolStrip,
  Transport,
  XpChip,
} from './parts';
import type { RunStageProps } from './types';

type Props = RunStageProps & { showFeed: boolean; bellXP: number | null };

/** A phone propped sideways. With the camera on it's the split screen from a fight broadcast, cut on the slant. */
export function RunLandscape(props: Props) {
  return props.showFeed ? <LandscapeFeed {...props} /> : <LandscapePlain {...props} />;
}

function LandscapePlain({ view, actions, flash, cameraOn, feed, onDismissProblem, problemDismissed, bellXP }: Props) {
  const hasCombo = view.combo.length > 0;
  return (
    <div className="stage-land-plain">
      <div className="flex min-h-0 min-w-0 flex-col pb-2">
        <div className="stage-toprow">
          <StageBug view={view} className="min-w-0" />
          <AirLight view={view} cameraOn={cameraOn} feedLive={false} />
        </div>
        <FlashLayer flash={flash} className="left-0 top-[30cqh]" />
        <div className="mt-1 flex items-center justify-between gap-3">
          <StageHeadline view={view} />
          <XpChip flash={flash} />
          <span className="lab truncate">
            Elapsed <span data-testid="run-elapsed">{view.elapsed}</span>
          </span>
        </div>
        <SegmentTitle view={view} className="ml-3 mt-1" />
        {bellXP != null && <BellPlate view={view} xp={bellXP} className="mt-1" />}
        <ClockFace view={view} className="ml-3 mt-1 flex-1 mr-[7cqh]" />
        {view.segmentCount > 0 && (
          <SegmentBar
            className="ml-3 mt-1"
            total={view.segmentCount}
            filled={Math.max(0, view.segmentIndex - 1)}
            current={view.kind === 'prep' ? -1 : view.segmentIndex - 1}
            height="0.6875rem"
            gold={view.championship}
          />
        )}
      </div>
      <div className="flex min-h-0 min-w-0 flex-col gap-1.5 pb-2 pr-3 pt-1.5">
        <ToolStrip actions={actions} cameraOn={cameraOn} className="text-base" />
        <TimeAdjust onAdjust={actions.onAdjust} className="text-lg" />
        <FeedBanner feed={feed} onDismiss={onDismissProblem} dismissed={problemDismissed} />
        {hasCombo ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {view.comboLabel && <span className="lab lab-lime shrink-0">{view.comboLabel}</span>}
            <ComboPlates moves={view.combo} names={false} className="mt-1 min-h-0 flex-1" />
          </div>
        ) : view.kind === 'freestyle' ? (
          <div className="min-h-0 flex-1">
            <FreestylePlate />
          </div>
        ) : (
          <SessionTape view={view} className="min-h-0 flex-1 overflow-hidden" />
        )}
        <Transport view={view} actions={actions} className="shrink-0" />
      </div>
    </div>
  );
}

function LandscapeFeed({ view, actions, flash, cameraOn, feed, counting, onDismissProblem, problemDismissed, bellXP, liveLog }: Props) {
  const hasCombo = view.combo.length > 0;
  const live = feed?.status === 'live';
  return (
    <>
      <div className="absolute left-0 top-2 z-20 w-[56cqw] pl-0">
        <StageBug view={view} className="min-w-0" />
      </div>
      <FlashLayer flash={flash} className="left-0 top-[30cqh]" />
      <div className="absolute bottom-2 left-4 z-20 flex w-[42cqw] flex-col items-start gap-1.5">
        <XpChip flash={flash} />
        <FeedBanner feed={feed} onDismiss={onDismissProblem} dismissed={problemDismissed} />
        <AirLight view={view} cameraOn={cameraOn} feedLive={live} />
      </div>
      {feed?.cue && <CuePlate cue={feed.cue} className="absolute bottom-9 left-0 z-20 w-[50cqw]" textClass="text-[3rem] whitespace-normal" />}
      <div className="stage-land-col">
        <ToolStrip actions={actions} cameraOn={cameraOn} className="text-base" />
        <div className="mt-1 flex items-center justify-between gap-3">
          <SegmentTitle view={view} />
          <span className="lab shrink-0">
            <span data-testid="run-elapsed">{view.elapsed}</span>
          </span>
        </div>
        {bellXP != null && <BellPlate view={view} xp={bellXP} />}
        <ClockFace view={view} className={cn('mt-0.5', hasCombo ? 'flex-[2]' : 'flex-[3]')} />
        {view.paused && <TimeAdjust onAdjust={actions.onAdjust} className="mt-1 text-lg" />}
        {hasCombo ? (
          <>
            {view.comboLabel && <span className="lab lab-lime mt-1 shrink-0">{view.comboLabel}</span>}
            <ComboPlates moves={view.combo} names={false} className="mt-1 min-h-0 flex-[2]" />
            <NextComboRow view={view} className="[@media(max-height:360px)]:hidden" />
          </>
        ) : view.kind === 'freestyle' ? (
          <div className="mt-1 min-h-0 flex-1">
            <FreestylePlate />
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-3">
            <PunchCount feed={feed} counting={counting} size="text-[3.25rem]" className="shrink-0" />
            {liveLog ? <div className="min-w-0 flex-1">{liveLog}</div> : <PunchStats feed={feed} className="min-w-0 flex-1 [@media(max-height:360px)]:hidden" />}
          </div>
        )}
        {!feed && <LevelBar level={view.level} percent={view.levelPercent} className="mt-1" />}
        <Transport view={view} actions={actions} className="mt-1.5 shrink-0" />
      </div>
    </>
  );
}
