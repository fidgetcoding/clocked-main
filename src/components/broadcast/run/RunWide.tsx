import { cn } from '@/lib/utils';
import { FitText } from '../FitText';
import { LevelBar } from '../LevelBar';
import { Plate } from '../Plate';
import { SegmentBar } from '../SegmentBar';
import { BellPlate, StageHeadline } from './headlines';
import {
  AirLight,
  ClockFace,
  ComboBlock,
  CuePlate,
  FeedBanner,
  FlashLayer,
  FreestylePlate,
  NextComboRow,
  PunchCount,
  PunchStats,
  RunTicker,
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

/** A laptop across the room. With the camera on it's the full broadcast. */
export function RunWide(props: Props) {
  return props.showFeed ? <WideFeed {...props} /> : <WidePlain {...props} />;
}

function WidePlain({ view, actions, flash, cameraOn, feed, onDismissProblem, problemDismissed, bellXP }: Props) {
  const hasCombo = view.combo.length > 0;
  return (
    <div className="stage-wide-plain">
      <div className="stage-toprow col-span-2">
        <StageBug view={view} className="min-w-0" />
        <div className="flex items-center gap-6">
          <ToolStrip actions={actions} cameraOn={cameraOn} className="w-[26rem]" />
          <AirLight view={view} cameraOn={cameraOn} feedLive={false} className="stage-air" />
        </div>
      </div>
      <FlashLayer flash={flash} className="left-0 top-[36cqh]" />

      <div className="flex min-h-0 min-w-0 flex-col pb-3 pl-8">
        <div className="-ml-8 mt-1 flex items-center gap-4">
          <StageHeadline view={view} className="!h-11 pl-7 !text-[2rem]" />
          <XpChip flash={flash} className="h-10 text-[1.75rem]" />
        </div>
        {bellXP != null && (
          <div className="-ml-8 mt-2">
            <BellPlate view={view} xp={bellXP} className="pl-7" />
          </div>
        )}
        <ClockFace view={view} className="mt-2 flex-1" />
        {view.segmentCount > 0 && (
          <SegmentBar
            className="mt-2"
            total={view.segmentCount}
            filled={Math.max(0, view.segmentIndex - 1)}
            current={view.kind === 'prep' ? -1 : view.segmentIndex - 1}
            height="1.125rem"
            gold={view.championship}
          />
        )}
        <div className="mt-1.5 flex justify-between gap-4">
          <span className="lab lab-w text-base">
            {view.segmentIndex > 0 ? `Segment ${view.segmentIndex} of ${view.segmentCount}` : view.segmentCount > 0 ? `${view.segmentCount} segments` : view.phaseName}
          </span>
          <span className="lab text-base">
            Elapsed <span data-testid="run-elapsed">{view.elapsed}</span>
          </span>
        </div>
        <LevelBar level={view.level} percent={view.levelPercent} gold={view.championship} className="mt-2 shrink-0" />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col pb-3 pl-6 pr-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="fx truncate text-[2.75rem]">{view.segmentName}</h2>
          <NextComboRow view={view} />
        </div>
        <TimeAdjust onAdjust={actions.onAdjust} className="mt-2 text-2xl" />
        <FeedBanner feed={feed} onDismiss={onDismissProblem} dismissed={problemDismissed} className="mt-2" />
        {hasCombo ? (
          <ComboBlock view={view} bleed={false} className="mt-3 flex-1" />
        ) : view.kind === 'freestyle' ? (
          <div className="mt-3 min-h-0 flex-1">
            <FreestylePlate />
          </div>
        ) : (
          <div className="mt-3 flex min-h-0 flex-1 flex-col justify-end">
            <SessionTape view={view} className="[&_span.fx]:text-[2.75rem]" />
          </div>
        )}
        <Transport view={view} actions={actions} size="lg" className="mt-3 shrink-0" />
      </div>

      <RunTicker view={view} feedCount={feed?.count} flash={flash} className="col-span-2 ticker-wide" />
    </div>
  );
}

function WideFeed({ view, actions, flash, cameraOn, feed, counting, onDismissProblem, problemDismissed, bellXP }: Props) {
  const hasCombo = view.combo.length > 0;
  const live = feed?.status === 'live';
  return (
    <div className="stage-col">
      <div className="stage-toprow">
        <StageBug view={view} className="min-w-0" />
        <div className="flex items-center gap-6">
          <ToolStrip actions={actions} cameraOn={cameraOn} className="w-[26rem]" />
          <AirLight view={view} cameraOn={cameraOn} feedLive={live} className="stage-air" />
        </div>
      </div>
      <FlashLayer flash={flash} className="left-0 top-[66cqh]" />

      <div className="stage-wide-body">
        {/* The punch-stat panel, cut on the slant */}
        <div className="stage-panel">
          <div className="flex items-center justify-between gap-2">
            <span className="lab lab-lime text-base">Punch stats, this session</span>
            <XpChip flash={flash} />
          </div>
          <PunchCount feed={feed} counting={counting} size="text-[8rem]" className="mt-1" />
          <PunchStats feed={feed} large className="mt-3" />
          <p className="lab mt-3">Stays on this device</p>
        </div>

        <div className="stage-wide-right">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StageHeadline view={view} bleed={false} className="!h-9 !text-[1.625rem]" />
            <SegmentTitle view={view} className="bg-background/70 px-1.5 py-0.5 text-sm" />
            <span className="lab lab-w ml-auto bg-background/70 px-1.5 py-0.5 text-sm">
              Elapsed <span data-testid="run-elapsed">{view.elapsed}</span>
            </span>
          </div>
          {bellXP != null && <BellPlate view={view} xp={bellXP} className="mt-1" />}
          <ClockFace view={view} className={cn('stage-shadow mt-1', hasCombo ? 'flex-[2]' : 'flex-[3]')} />
          {view.paused && <TimeAdjust onAdjust={actions.onAdjust} className="mt-1.5 text-2xl" />}
          {hasCombo ? (
            <ComboBlock view={view} bleed={false} className="mt-2 flex-[3]" />
          ) : view.kind === 'freestyle' ? (
            <div className="mt-2 min-h-0 flex-1">
              <FreestylePlate />
            </div>
          ) : (
            <Plate tone="black" className="mt-2 h-[4.5rem] w-full shrink-0 px-5">
              <FitText className="h-[70%]" align="center" lineHeight={0.92}>
                {view.upNext ? `Next: ${view.upNext}` : ''}
              </FitText>
            </Plate>
          )}
          <Transport view={view} actions={actions} size="lg" className="mt-2.5 shrink-0" />
        </div>

        <div className="absolute bottom-3 left-0 right-[38cqw] z-20 flex flex-col items-start gap-2">
          <FeedBanner feed={feed} onDismiss={onDismissProblem} dismissed={problemDismissed} className="ml-8" />
          {feed?.cue && <CuePlate cue={feed.cue} textClass="text-[8rem] pl-8" />}
        </div>
      </div>

      <RunTicker view={view} feedCount={feed?.count} flash={flash} className="ticker-wide" />
    </div>
  );
}
