import { useEffect, useRef } from 'react';
import { VoiceToggle } from '@/components/broadcast/VoiceToggle';
import { useSpeechSynthesis, useVoicePreload } from '@/hooks/useSpeechSynthesis';
import { useStance } from '@/hooks/useStance';
import { promptFor, stepLine, tallyLine, voiceLine, type CalibrationActions, type CalibrationStep, type CalibrationView } from '@/lib/punch/calibration';
import { FRAMING_MESSAGES } from '@/lib/punch/framing';
import { PUNCH_LABELS, PUNCH_NUMBERS } from '@/lib/punch/round';
import { describeCamera, expectedQuality, placementAdvice } from '@/lib/punch/startCheck';
import { cn } from '@/lib/utils';
import { VOICE_LINES } from '@/lib/voice/lines';

interface CalibrationFlowProps {
  calibration: CalibrationView;
  actions: CalibrationActions;
  /** Starts the session once calibration is done. */
  onStart: () => void;
  startLabel?: string;
  className?: string;
}

const SETUP_DO = [
  'Show your shoulders and hips, with your head in the picture.',
  'Prop the phone in front of you at hip height. If the bag is in the way, go just far enough around to see past it.',
  'Stand 6 to 10 feet back.',
  'Add light if the room is dim.',
];
const SETUP_DONT = "Don't put the phone behind the bag. It can't see you there.";

const button = 'plate fx h-12 px-4 text-xl';

const CALIBRATION_LINE_IDS = VOICE_LINES.filter((line) => line.section === 'calibration').map((line) => line.id);

const STATUS_MARK: Record<CalibrationStep['status'], string> = {
  waiting: '…',
  seen: 'Seen',
  unnamed: 'Counted',
  wrong: 'Misread',
  missed: 'Missed',
  skipped: 'Skipped',
};

function Steps({ steps, current }: { steps: CalibrationStep[]; current?: number }) {
  return (
    <ol className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6" data-testid="calibration-steps">
      {steps.map((step, index) => (
        <li
          key={step.punch}
          data-status={step.status}
          className={cn(
            'border border-surface-3 px-1.5 py-1 text-center',
            index === current && 'border-volt',
            (step.status === 'seen' || step.status === 'unnamed') && 'bg-volt/15',
          )}
        >
          <span className="fx block text-xl leading-none">{PUNCH_NUMBERS[step.punch]}</span>
          <span className="lab block truncate">{index === current && step.status === 'waiting' ? 'Now' : STATUS_MARK[step.status]}</span>
        </li>
      ))}
    </ol>
  );
}

/** The calibration run before a camera session: setup, guard, one of each punch, then what to expect. */
export function CalibrationFlow({ calibration, actions, onStart, startLabel = 'Start workout', className }: CalibrationFlowProps) {
  const { stance, setStance } = useStance();
  const { initialize, speak } = useSpeechSynthesis();
  useVoicePreload(CALIBRATION_LINE_IDS);
  const { phase, steps, stepIndex, result } = calibration;

  const said = useRef<string | null>(null);
  const line = voiceLine(calibration);
  const lineKey = `${phase}|${stepIndex}|${steps[stepIndex]?.status}`;
  useEffect(() => {
    if (!line || said.current === lineKey) return;
    said.current = lineKey;
    speak(line, { rate: 1.05 });
  }, [line, lineKey, speak]);

  const skipAll = (
    <button type="button" onClick={actions.skip} className={cn(button, 'plate-graphite')}>
      Skip calibration
    </button>
  );

  let body: React.ReactNode;
  if (phase === 'choose') {
    body = (
      <>
        <h2 className="fx text-4xl leading-none">Calibrate first?</h2>
        <p className="mt-2 text-base leading-snug text-muted-foreground">
          About a minute. It checks where your camera is and that it can see each punch.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              initialize();
              actions.begin();
            }}
            className={cn(button, 'plate-lime')}
          >
            Calibrate
          </button>
          {skipAll}
        </div>
      </>
    );
  } else if (phase === 'setup') {
    const ok = calibration.framing === 'ok';
    body = (
      <>
        <p className="lab">Setup</p>
        <h2 className="fx text-4xl leading-none">{ok ? 'Looks good. Hold there.' : 'Get in the picture'}</h2>
        {!ok && (
          <p role="status" data-testid="calibration-framing" className="mt-2 text-lg leading-snug">
            {FRAMING_MESSAGES[calibration.framing]}
          </p>
        )}
        <div className="mt-2 h-1.5 bg-surface-3" aria-hidden="true">
          <div className="h-full bg-volt transition-[width]" style={{ width: `${Math.round(calibration.setupProgress * 100)}%` }} />
        </div>
        <ul className="mt-2 space-y-0.5 text-base leading-snug text-muted-foreground">
          {SETUP_DO.map((tip) => (
            <li key={tip}>Do: {tip}</li>
          ))}
          <li>{SETUP_DONT}</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={actions.skipStep} className={cn(button, 'plate-white')}>
            Skip setup
          </button>
          {skipAll}
        </div>
      </>
    );
  } else if (phase === 'guard') {
    body = (
      <>
        <p className="lab">Guard</p>
        <div className="flex items-end gap-4">
          <h2 className="fx text-4xl leading-none">Hands up. Hold still.</h2>
          <span className="fx text-5xl leading-none text-volt" data-testid="calibration-countdown">{calibration.secondsLeft}</span>
        </div>
        <p className="mt-2 text-base leading-snug text-muted-foreground">Checking where your camera is.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={actions.skipStep} className={cn(button, 'plate-white')}>
            Skip this step
          </button>
          {skipAll}
        </div>
      </>
    );
  } else if (phase === 'punches') {
    const step = steps[stepIndex];
    const stuck = step.status === 'wrong' || step.status === 'missed';
    body = (
      <>
        <p className="lab">
          Punch {stepIndex + 1} of {steps.length}
        </p>
        <h2 className="fx text-5xl leading-none" data-testid="calibration-prompt">
          <span className="text-volt">{PUNCH_NUMBERS[step.punch]}</span> {PUNCH_LABELS[step.punch]}
        </h2>
        <p role="status" className="mt-2 text-lg leading-snug" data-testid="calibration-step-line">
          {step.status === 'waiting' ? `${promptFor(step.punch)}.` : stepLine(step)}
        </p>
        {step.tip && <p className="text-base leading-snug text-muted-foreground" data-testid="calibration-tip">{step.tip}</p>}
        <Steps steps={steps} current={stepIndex} />
        <div className="mt-3 flex flex-wrap gap-3">
          {stuck && (
            <button type="button" onClick={actions.retryPunch} className={cn(button, 'plate-lime')}>
              Try again
            </button>
          )}
          <button type="button" onClick={actions.skipPunch} className={cn(button, 'plate-white')}>
            Skip punch
          </button>
          {skipAll}
        </div>
      </>
    );
  } else {
    const advice = result && placementAdvice(result);
    const switchTo = result?.stance && result.stance !== stance ? result.stance : null;
    body = (
      <>
        <p className="lab">Calibration done</p>
        <h2 className="fx text-4xl leading-none">{tallyLine(steps)}</h2>
        {result ? (
          <>
            <p className="mt-2 text-lg leading-snug">{describeCamera(result)}</p>
            <p className="text-base leading-snug" data-testid="calibration-expect">{expectedQuality(result)}</p>
            {advice && <p className="text-base leading-snug text-muted-foreground">{advice}</p>}
          </>
        ) : (
          <p className="mt-2 text-base leading-snug text-muted-foreground">Camera check skipped, so there's no read on this spot.</p>
        )}
        <Steps steps={steps} />
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              actions.finish();
              onStart();
            }}
            className={cn(button, 'plate-lime')}
          >
            {startLabel}
          </button>
          {switchTo && (
            <button type="button" onClick={() => setStance(switchTo)} className={cn(button, 'plate-white')}>
              You look {switchTo}. Switch?
            </button>
          )}
          <button type="button" onClick={actions.restart} className={cn(button, 'plate-graphite')}>
            Calibrate again
          </button>
        </div>
      </>
    );
  }

  return (
    <section
      aria-label="Calibration"
      data-testid="calibration"
      data-phase={phase}
      data-calibration-punch={phase === 'punches' ? steps[stepIndex].punch : undefined}
      className={cn('calibration bg-background/90', className)}
    >
      {/* Calibration talks you through it. Mute it right here */}
      <VoiceToggle compact className="float-right mb-1 ml-3" />
      {body}
    </section>
  );
}
