import type { CSSProperties, ReactNode } from 'react';
import { BadgeArt } from '@/components/ui/GameArt';
import { Button } from '@/components/ui/button';
import { CAMERA_MESSAGES } from '@/lib/punch/framing';
import { PUNCH_LABELS, PUNCH_ORDER } from '@/lib/punch/round';
import { cn } from '@/lib/utils';
import { FitText } from '../FitText';
import { OnAir } from '../OnAir';
import { Plate } from '../Plate';
import { ScoreBug } from '../ScoreBug';
import { Ticker } from '../Ticker';
import { CameraIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, StopIcon } from '../icons';
import type { ComboMove } from './moves';
import type { RunActions, RunFlash, RunStageProps, RunView } from './types';
import { isRest, runTickerItems } from './view';

/** The light in the corner says what's actually going out. */
function airLabel(view: RunView, cameraOn: boolean, feedLive: boolean) {
  if (view.idle) return { state: 'off' as const, text: 'Standing by' };
  if (view.paused) return { state: 'off' as const, text: 'Paused' };
  if (isRest(view)) return { state: 'off' as const, text: 'Back soon' };
  if (cameraOn && !feedLive) return { state: 'on' as const, text: 'Feed incoming' };
  return { state: 'live' as const, text: 'On air' };
}

export function AirLight({ view, cameraOn, feedLive, className }: { view: RunView; cameraOn: boolean; feedLive: boolean; className?: string }) {
  const { state, text } = airLabel(view, cameraOn, feedLive);
  return (
    <OnAir state={state} className={className}>
      {text}
    </OnAir>
  );
}

export function StageBug({ view, className }: { view: RunView; className?: string }) {
  const tone = view.championship ? 'gold' : isRest(view) || view.cooldown ? 'graphite' : 'lime';
  const mid =
    view.kind === 'prep' || view.idle
      ? view.workoutName
      : isRest(view) && view.round
        ? `After round ${view.round}`
        : view.roundLabel ?? view.phaseName;
  return <ScoreBug tone={tone} mid={mid} className={cn('max-w-full', className)} />;
}

/** The small jobs: leave, start over, call it done, camera. */
export function ToolStrip({ actions, cameraOn, className }: { actions: RunActions; cameraOn: boolean; className?: string }) {
  return (
    <div className={cn('tool-strip flex items-center gap-2.5 text-lg', className)}>
      <button type="button" onClick={actions.onLeave} aria-label="Leave workout" title="Leave workout" className="plate plate-graphite fx h-11 flex-1 px-2.5">
        Leave
      </button>
      {actions.onRestart && (
        <button type="button" onClick={actions.onRestart} title="Restart from beginning" className="plate plate-graphite fx h-11 flex-1 px-2.5">
          Restart
        </button>
      )}
      {actions.onRestart && (
        <button type="button" onClick={actions.onFinish} title="Complete workout early" className="plate plate-graphite fx h-11 flex-1 px-2.5">
          Done
        </button>
      )}
      <button
        type="button"
        onClick={actions.onToggleCamera}
        aria-label="Punch camera"
        aria-pressed={cameraOn}
        title="Punch camera"
        className={cn('plate fx h-11 flex-1 gap-1.5 px-2.5', cameraOn ? 'plate-white' : 'plate-graphite')}
      >
        <CameraIcon className="tool-strip-icon size-4" />
        Camera
      </button>
    </div>
  );
}

export function ClockFace({ view, className, max }: { view: RunView; className?: string; max?: number }) {
  return (
    <div
      role="timer"
      aria-label={`${view.clock} ${view.kind === 'freeform' ? 'elapsed' : 'remaining'}`}
      data-testid="run-clock"
      className={cn('clock-face fx timer-display min-h-0', className)}
    >
      <FitText className="h-full" max={max}>
        {view.clock}
      </FitText>
    </div>
  );
}

const ADJUSTMENTS = [-30, -15, 15, 30];

export function TimeAdjust({ onAdjust, className }: { onAdjust?: RunActions['onAdjust']; className?: string }) {
  if (!onAdjust) return null;
  return (
    <div className={cn('flex gap-3.5 text-xl', className)}>
      {ADJUSTMENTS.map((seconds) => (
        <button key={seconds} type="button" onClick={() => onAdjust(seconds)} className="plate plate-steel fx h-11 flex-1">
          {seconds > 0 ? '+' : ''}
          {seconds}s
        </button>
      ))}
    </div>
  );
}

/** Pause is the biggest thing you can hit. Back and skip sit either side. */
export function Transport({ view, actions, size = 'md', className }: { view: RunView; actions: RunActions; size?: 'md' | 'lg'; className?: string }) {
  const main = view.paused || view.idle;
  const heightClass = size === 'lg' ? 'h-16 text-[2.25rem]' : 'h-14 text-3xl';
  const pauseTone = view.kind === 'prep' || main ? 'plate-lime' : 'plate-white';
  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      {actions.onBack && (
        <button
          type="button"
          onClick={actions.onBack}
          disabled={view.kind === 'prep'}
          aria-label="Back one segment"
          className={cn('plate plate-graphite fx w-[4.125rem] shrink-0 disabled:opacity-40', heightClass)}
        >
          <PrevIcon className="size-5" />
        </button>
      )}
      <button
        type="button"
        onClick={main ? actions.onPlay : actions.onPause}
        className={cn('plate fx min-w-0 flex-1 gap-3', pauseTone, heightClass)}
      >
        {main ? <PlayIcon className="size-5" /> : <PauseIcon className="size-5" />}
        {!main ? 'Pause' : view.kind === 'freeform' && view.idle ? 'Go live' : 'Play'}
      </button>
      {actions.onSkip && (
        <button type="button" onClick={actions.onSkip} aria-label="Skip segment" className={cn('plate plate-graphite fx w-[4.125rem] shrink-0', heightClass)}>
          <NextIcon className="size-5" />
        </button>
      )}
      {view.kind === 'freeform' && !view.idle && (
        <button type="button" onClick={actions.onFinish} aria-label="Finish session" className={cn('plate plate-graphite fx gap-2 px-6 shrink-0', heightClass)}>
          <StopIcon className="size-4" />
          Stop
        </button>
      )}
    </div>
  );
}

const perRow = (count: number) => (count <= 4 ? count : Math.ceil(count / 2));

/**
 * The combo on plates. Punches lean forward and defense leans back, so you can tell a slip from a jab across
 * the room. The plates fill the box they're given.
 */
export function ComboPlates({ moves, names = true, className }: { moves: ComboMove[]; names?: boolean; className?: string }) {
  const drills = moves.every((move) => move.type === 'drill');
  const columns = drills ? 1 : perRow(moves.length);
  return (
    <div
      className={cn('combo-grid', drills && 'combo-grid-drill', className)}
      style={{ '--combo-cols': columns, '--combo-rows': Math.ceil(moves.length / columns) } as CSSProperties}
    >
      {moves.map((move, index) => (
        <div key={`${move.display}-${index}`} className="combo-cell">
          <span
            className={cn(
              'plate fx combo-plate plate-wipe',
              move.type === 'defense' ? 'plate-white plate-back' : move.type === 'movement' ? 'plate-steel' : 'plate-lime',
              drills && 'combo-plate-text',
            )}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <FitText className="combo-glyph" align="center" lineHeight={0.92}>
              {move.display}
            </FitText>
          </span>
          {names && move.name && <span className="fx combo-name">{move.name}</span>}
        </div>
      ))}
    </div>
  );
}

export function ComboBlock({ view, className, names = true, bleed = true }: { view: RunView; className?: string; names?: boolean; bleed?: boolean }) {
  if (view.combo.length === 0) return null;
  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      {/* The combo label is the top of this card */}
      {view.comboLabel && (
        <Plate tone="lime" bleed={bleed ? 'left' : undefined} className={cn('h-[2.375rem] w-fit shrink-0 text-[1.75rem]', bleed ? 'pl-1 pr-6' : 'px-5')}>
          {view.comboLabel}
        </Plate>
      )}
      <ComboPlates moves={view.combo} names={names} className="mt-3 min-h-0 flex-1" />
    </div>
  );
}

/** Freestyle gets the words instead of numbers. */
export function FreestylePlate({ className }: { className?: string }) {
  return (
    <Plate tone="lime" bleed="both" className={cn('flex h-full min-h-[4rem] w-full justify-start pl-1', className)}>
      <FitText className="h-[86%] w-full" lineHeight={0.92}>
        Freestyle
      </FitText>
    </Plate>
  );
}

export function NextComboRow({ view, className }: { view: RunView; className?: string }) {
  if (!view.nextCombo) return null;
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <span className="lab lab-w">Next combo</span>
      <span className="fx text-3xl">{view.nextCombo}</span>
    </div>
  );
}

const twoDigit = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Up next and what you've banked, in tale-of-the-tape rows. */
export function SessionTape({ view, className }: { view: RunView; className?: string }) {
  return (
    <div className={cn('divide-y divide-surface-2', className)}>
      <div className="flex items-baseline justify-between gap-3 py-1.5">
        <span className="lab">Up next</span>
        <span className="fx truncate text-3xl text-volt">
          {view.upNext}
          {view.upNextSeconds != null && <span className="ml-3 text-foreground">{twoDigit(view.upNextSeconds)}</span>}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 py-1.5">
        <span className="lab">Session XP</span>
        <span className="fx text-3xl text-volt" data-testid="session-xp">
          {view.sessionXP.toLocaleString()}
        </span>
      </div>
      {view.streak > 0 && (
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <span className="lab">Day streak{view.multiplier > 1 ? `, x${view.multiplier}` : ''}</span>
          <span className="fx text-3xl">{view.streak}</span>
        </div>
      )}
    </div>
  );
}

export function RunTicker({ view, feedCount, flash, className }: { view: RunView; feedCount?: number | null; flash?: RunFlash; className?: string }) {
  return (
    <Ticker
      items={runTickerItems(view, feedCount, flash)}
      tone={isRest(view) || view.idle ? 'dark' : 'lime'}
      paused={view.paused}
      className={className}
    />
  );
}

const SHORT_PUNCH: Record<string, string> = {
  'Lead hook': 'L hook',
  'Rear hook': 'R hook',
  'Lead uppercut': 'L upper',
  'Rear uppercut': 'R upper',
};

/** The live tracker's tally: how many, and of what. */
export function PunchStats({ feed, large, className }: { feed: RunStageProps['feed']; large?: boolean; className?: string }) {
  if (!feed) return null;
  const rows = PUNCH_ORDER.filter((punch) => punch !== 'punch' || feed.counts.punch > 0)
    .slice(0, large ? 7 : 4)
    .map((punch) => {
      const label = punch === 'punch' ? 'Other' : PUNCH_LABELS[punch];
      return { label: SHORT_PUNCH[label] ?? label, value: feed.counts[punch] };
    });
  const top = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className={cn('space-y-[3px]', className)} data-testid="punch-stat-bars">
      {rows.map((row) => (
        <div key={row.label} className={cn('grid items-center gap-2.5 fx', large ? 'grid-cols-[5.25rem_1fr_2.25rem] text-[1.625rem]' : 'grid-cols-[4.5rem_1fr_2rem] text-xl')}>
          <span className="whitespace-nowrap">{row.label}</span>
          <i
            className={cn('block -skew-x-[14deg] transition-[width] duration-150', row.value > 0 ? 'bg-volt' : 'bg-surface-3', large ? 'h-4' : 'h-3')}
            style={{ width: row.value > 0 ? `${(row.value / top) * 100}%` : '6px' }}
          />
          <em className="text-right not-italic">{row.value}</em>
        </div>
      ))}
    </div>
  );
}

export function PunchCount({ feed, counting, className, size = 'text-[5.5rem]' }: { feed: RunStageProps['feed']; counting?: boolean; className?: string; size?: string }) {
  if (!feed || feed.status !== 'live') return null;
  return (
    <div className={cn('flex items-end gap-2.5', className)}>
      <span className={cn('fx text-volt', size)} data-testid="camera-panel-count">
        {feed.count}
      </span>
      <span className="pb-1">
        <span className="lab lab-w block">{counting ? (feed.count === 1 ? 'Punch' : 'Punches') : 'Not counting'}</span>
        {feed.combo && <span className="fx block text-2xl">{feed.combo}</span>}
        {feed.lastLabel && <span className="lab block">Last: {feed.lastLabel}</span>}
      </span>
    </div>
  );
}

/** One thing to fix, slapped across the picture in the only red on screen. */
export function CuePlate({ cue, className, textClass }: { cue: string; className?: string; textClass?: string }) {
  return (
    <div className={cn('pointer-events-none plate-slap', className)} role="status" data-testid="camera-panel-message">
      <Plate tone="red" bleed="left" className={cn('flex w-fit justify-start py-2 pl-3 pr-8 leading-[.86]', textClass)}>
        {cue}
      </Plate>
    </div>
  );
}

/** The tracker can't see you, or the feed has dropped. Says what to do, in a line you can read from back there. */
export function FeedBanner({
  feed,
  onDismiss,
  dismissed,
  className,
}: {
  feed: RunStageProps['feed'];
  onDismiss?: () => void;
  dismissed?: boolean;
  className?: string;
}) {
  if (!feed) return null;
  if (feed.problem) {
    if (dismissed) return null;
    return (
      <div data-testid="camera-panel-problem" className={cn('bg-background/90 p-3', className)}>
        <span className="lab lab-w">We lost the feed</span>
        <p className="fx mt-1 text-2xl">{CAMERA_MESSAGES[feed.problem].title}</p>
        <p className="text-base text-muted-foreground">Your session carries on without it.</p>
        <Button size="sm" variant="secondary" className="mt-2" onClick={onDismiss} aria-label="Dismiss camera message">
          Dismiss
        </Button>
      </div>
    );
  }
  if (feed.paused) {
    return (
      <div className={cn('bg-background/90 p-3', className)}>
        <p className="fx text-2xl">Feed cut. You left the tab.</p>
        <Button size="sm" className="mt-2 gap-2" onClick={feed.resume}>
          <CameraIcon className="size-4" />
          Turn camera back on
        </Button>
      </div>
    );
  }
  if (feed.warning) {
    return (
      <div className={cn('pointer-events-none', className)} role="status" data-testid="camera-panel-warning">
        <span className="inline-block bg-background/85 px-3 py-1.5 fx text-2xl leading-none">{feed.warning}</span>
      </div>
    );
  }
  return null;
}

/** The start bonus, sitting in the row it belongs to rather than over it. */
export function XpChip({ flash, className }: { flash?: RunFlash; className?: string }) {
  if (!flash?.xp) return null;
  return (
    <Plate key={flash.xp.id} tone="lime" className={cn('xp-out h-7 shrink-0 px-3 text-xl', className)}>
      +{flash.xp.amount} XP
    </Plate>
  );
}

/** The hits that land on top of whatever's running, then clear. They never take a tap. */
export function FlashLayer({ flash, className }: { flash?: RunFlash; className?: string }) {
  if (!flash?.comboXP && !flash?.badge) return null;
  return (
    <div className={cn('pointer-events-none absolute z-30 flex flex-col items-start gap-2', className)}>
      {flash.comboXP && (
        <Plate key={flash.comboXP.id} tone={flash.comboXP.isChampionship ? 'gold' : 'lime'} bleed="left" className="xp-out h-16 pl-3 pr-6 text-5xl">
          +{flash.comboXP.amount.toFixed(1)} XP{flash.comboXP.isChampionship ? ', 2x' : ''}
        </Plate>
      )}
      {flash.badge && (
        <div key={flash.badge.id} className="plate-slap flex items-center gap-2.5 bg-background/90 py-1.5 pl-3 pr-4">
          <BadgeArt id={flash.badge.artId} className="size-12" />
          <span>
            <span className="lab lab-lime block">Stat alert</span>
            <span className="fx block text-2xl">
              {flash.badge.name} <span className="text-volt">+{flash.badge.xp.toLocaleString()} XP</span>
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

/** The segment's name. The one heading on a run screen, whatever else is on it. */
export function SegmentTitle({ view, className }: { view: RunView; className?: string }) {
  return <h2 className={cn('lab lab-lime truncate', className)}>{view.segmentName}</h2>;
}

export const PhaseChip = ({ children, className, bleed = true }: { children: ReactNode; className?: string; bleed?: boolean }) => (
  <Plate tone="graphite" bleed={bleed ? 'left' : undefined} className={cn('h-[1.875rem] w-fit max-w-full justify-start pr-4 text-[1.3125rem]', bleed ? 'pl-1' : 'pl-4', className)}>
    <span className="truncate">{children}</span>
  </Plate>
);
