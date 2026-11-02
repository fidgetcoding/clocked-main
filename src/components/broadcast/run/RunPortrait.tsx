import { cn } from '@/lib/utils';
import { LevelBar } from '../LevelBar';
import { SegmentBar } from '../SegmentBar';
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
import { BellPlate, StageHeadline } from './headlines';

type Props = RunStageProps & { showFeed: boolean; bellXP: number | null; free: FreeSide };

/** A phone held upright. With the camera on the numbers sit on the floor below your feet. */
export function RunPortrait(props: Props) {
  return props.showFeed ? <PortraitFeed {...props} /> : <PortraitPlain {...props} />;
}

function PortraitPlain({ view, actions, flash, cameraOn, feed, onDismissProblem, problemDismissed, bellXP }: Props) {
  const hasCombo = view.combo.length > 0;
  return (
    <div className="stage-col px-0">
      <div className="stage-toprow">
        <StageBug view={view} className="min-w-0" />
        <AirLight view={view} cameraOn={cameraOn} feedLive={false} className="pr-3.5" />
      </div>
      <ToolStrip actions={actions} cameraOn={cameraOn} className="mt-1.5 px-4" />
      <FlashLayer flash={flash} className="left-0 top-[34cqh]" />
      <FeedBanner feed={feed} onDismiss={onDismissProblem} dismissed={problemDismissed} className="mx-4 mt-2" />

      <div className="mt-1.5 flex items-center justify-between gap-3 pr-4">
        <StageHeadline view={view} />
        <XpChip flash={flash} />
        <SegmentTitle view={view} className="text-right" />
      </div>

      {bellXP != null && <BellPlate view={view} xp={bellXP} className="mt-1" />}

      <ClockFace view={view} className={cn('mx-3', hasCombo ? 'flex-[2]' : 'flex-[3]')} />

      <div className="mx-4 mt-1">
        {view.segmentCount > 0 && (
          <SegmentBar
            total={view.segmentCount}
            filled={Math.max(0, view.segmentIndex - 1)}
            current={view.kind === 'prep' ? -1 : view.segmentIndex - 1}
            height="0.875rem"
            gold={view.championship}
          />
        )}
        <div className="mt-1 flex justify-between gap-3">
          <span className="lab lab-w">
            {view.segmentIndex > 0 ? `Segment ${view.segmentIndex} of ${view.segmentCount}` : view.segmentCount > 0 ? `${view.segmentCount} segments` : view.phaseName}
          </span>
          <span className="lab">
            Elapsed <span data-testid="run-elapsed">{view.elapsed}</span>
          </span>
        </div>
      </div>

      <TimeAdjust onAdjust={actions.onAdjust} className="mx-5 mt-2" />

      {hasCombo ? (
        <ComboBlock view={view} className="mt-2.5 flex-[3] px-4" />
      ) : view.kind === 'freestyle' ? (
        <div className="mt-2.5 min-h-0 flex-[2] px-4">
          <FreestylePlate />
        </div>
      ) : (
        <SessionTape view={view} className="mx-4 mt-2 shrink-0 [@media(max-height:620px)]:hidden" />
      )}

      {hasCombo && <NextComboRow view={view} className="mx-4 mt-1 shrink-0 [@media(max-height:620px)]:hidden" />}

      {!hasCombo && (
        <LevelBar level={view.level} percent={view.levelPercent} gold={view.championship} className="mx-4 mt-2 shrink-0 [@media(max-height:700px)]:hidden" />
      )}

      <Transport view={view} actions={actions} className="mx-5 my-2.5 shrink-0" />
      <RunTicker view={view} feedCount={feed?.count} flash={flash} />
    </div>
  );
}

function PortraitFeed(props: Props) {
  const { view, actions, flash, cameraOn, feed, onDismissProblem, problemDismissed } = props;
  return (
    <div className="stage-col">
      <div className="stage-toprow">
        <StageBug view={view} className="min-w-0" />
        <AirLight view={view} className="pr-3.5" />
      </div>
      <ToolStrip actions={actions} cameraOn={cameraOn} className="mt-1.5 px-4" />
      <FlashLayer flash={flash} className="left-0 top-[24cqh]" />
      <XpChip flash={flash} className="relative z-20 ml-4 mt-1.5" />
      <FreeSidePanel {...props} banner={<FeedBanner feed={feed} onDismiss={onDismissProblem} dismissed={problemDismissed} />} />
      <div className="mt-auto">
        <Transport view={view} actions={actions} className="mx-5 my-2.5" />
      </div>
      <RunTicker view={view} feedCount={feed?.count} flash={flash} />
    </div>
  );
}
