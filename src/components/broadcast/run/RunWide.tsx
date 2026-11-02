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
import { FreeSidePanel } from './FreeSidePanel';
import type { RunStageProps } from './types';
import type { FreeSide } from './useFreeSide';

type Props = RunStageProps & { showFeed: boolean; bellXP: number | null; free: FreeSide };

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
        <ClockFace view={view} className="mr-[6cqh] mt-2 flex-1" />
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

function WideFeed(props: Props) {
  const { view, actions, flash, cameraOn, feed, onDismissProblem, problemDismissed } = props;
  return (
    <div className="stage-col">
      <div className="stage-toprow">
        <StageBug view={view} className="min-w-0" />
        <div className="flex items-center gap-6">
          <ToolStrip actions={actions} cameraOn={cameraOn} className="w-[26rem]" />
          <AirLight view={view} className="stage-air" />
        </div>
      </div>
      <FlashLayer flash={flash} className="left-0 top-[66cqh]" />
      <XpChip flash={flash} className="absolute left-8 top-20 z-20" />
      <FreeSidePanel {...props} />
      <div className="absolute bottom-12 left-8 z-20 flex max-w-[50cqw] flex-col items-start gap-2">
        <FeedBanner feed={feed} onDismiss={onDismissProblem} dismissed={problemDismissed} />
      </div>
      <Transport view={view} actions={actions} size="lg" className="stage-controls-wide" />
      <RunTicker view={view} feedCount={feed?.count} flash={flash} className="ticker-wide mt-auto" />
    </div>
  );
}
