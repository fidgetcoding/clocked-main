import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SpotDiagram } from '@/components/lab/SpotDiagram';
import { SpotGrid } from '@/components/lab/SpotGrid';
import { useRecordSession } from '@/hooks/useRecordSession';
import { scoreRecording } from '@/lib/lab/angleScore';
import { ANGLE_SPOTS, moveFromPrevious, RUN_WORDS, spotLines, spotTitle, type AngleSpot, type LabRow, type LabStance, type SpotRun } from '@/lib/lab/angleSpots';
import { CAMERA_MESSAGES } from '@/lib/punch/framing';
import { RECORD_STEPS, type RecordStep } from '@/lib/punch/recording';

// Dev only (see App.tsx): films a real bag from each camera spot in turn and saves every take to disk.
// Progress lives on disk, so closing the tab and opening it again carries on where it stopped.

type Phase = 'loading' | 'welcome' | 'spot' | 'running' | 'saving' | 'scored' | 'paused' | 'finished';

interface Session {
  name: string;
  folder: string;
  stance: LabStance;
  skipped: string[];
  rows: LabRow[];
}

/** 3 of each punch, the same prompts, about 75 seconds with the get-ready gaps. */
const SHORT_STEPS: RecordStep[] = RECORD_STEPS.map((step) =>
  step.label === 'guard' ? { ...step, seconds: 6 } : { ...step, prompt: step.prompt.replace('10', '3'), expected: 3, seconds: 9 },
);
const SHOVE_STEPS: RecordStep[] = [{ label: 'guard', prompt: 'Hands up. No punches.', expected: 0, seconds: 10 }];
const STEPS: Record<SpotRun, RecordStep[]> = { short: SHORT_STEPS, full: RECORD_STEPS, shove: SHOVE_STEPS };
// ?quick=1 runs every step in a few seconds, for trying the lab out and for the browser test
const QUICK: Record<SpotRun, RecordStep[]> = {
  short: SHORT_STEPS.map((step) => ({ ...step, seconds: 4 })),
  full: RECORD_STEPS.map((step) => ({ ...step, seconds: 4 })),
  shove: SHOVE_STEPS.map((step) => ({ ...step, seconds: 4 })),
};
const COUNTDOWN_SECONDS = 10;

const today = () => new Date().toLocaleDateString('en-CA');

const big = 'rounded-2xl font-black uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-volt';
const primary = `${big} bg-volt text-black hover:bg-volt/90 h-24 px-10 text-4xl`;
const secondary = `${big} bg-surface-3 text-foreground hover:bg-surface-3/80 h-24 px-8 text-3xl`;
const small = `${big} bg-surface-3 text-foreground hover:bg-surface-3/80 h-14 px-6 text-xl`;

const releaseFocus = () => (document.activeElement as HTMLElement | null)?.blur();

const post = async <T,>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`/__lab/angles/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
  return data as T;
};

function Stat({ value, label, tone = 'text-foreground' }: { value: string | number; label: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-surface-3/60 px-5 py-4">
      <p className={`text-6xl font-black leading-none ${tone}`}>{value}</p>
      <p className="mt-2 text-lg uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

export default function AngleLab() {
  const [params] = useSearchParams();
  const quick = params.get('quick') === '1';
  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [savedPath, setSavedPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stance = session?.stance ?? 'orthodox';
  const spot = ANGLE_SPOTS[index];
  const rows = useMemo(() => Object.fromEntries((session?.rows ?? []).map((row) => [row.spotId, row])), [session]);
  const skipped = useMemo(() => session?.skipped ?? [], [session]);
  const shove = spot.run === 'shove';
  const steps = (quick ? QUICK : STEPS)[spot.run];
  const recorder = useRecordSession({
    stance,
    steps,
    getReadyMs: quick ? 600 : spot.run === 'short' ? 2000 : undefined,
    countdownSeconds: quick ? 1 : COUNTDOWN_SECONDS,
    countdownLine: shove ? 'Get to your spot. Shove the bag hard when I say go, then hands up.' : `Get to your spot. Starting in ${COUNTDOWN_SECONDS} seconds.`,
  });
  const { speak } = recorder;

  // Whatever the last sitting left open
  useEffect(() => {
    fetch('/__lab/angles/progress')
      .then((res) => res.json())
      .then((data: { session: Session | null }) => {
        setSession(data.session);
        setPhase('welcome');
      })
      .catch(() => setError('The lab needs the dev server: run npm run lab:angles.'));
  }, []);

  /** The first spot not filmed or skipped, from `from` on, or -1. */
  const nextOpen = useCallback(
    (from: number, current: Session) => {
      for (let i = from; i < ANGLE_SPOTS.length; i += 1) {
        const candidate = ANGLE_SPOTS[i];
        if (!current.rows.some((row) => row.spotId === candidate.id) && !current.skipped.includes(candidate.id)) return i;
      }
      return -1;
    },
    [],
  );

  const announce = useCallback(
    (target: AngleSpot, current: Session) => {
      const move = moveFromPrevious(target, ANGLE_SPOTS[ANGLE_SPOTS.indexOf(target) - 1]);
      const lines = spotLines(target, current.stance).map((line) => line.replace(/\b[A-Z]{2,}\b/g, (word) => word.toLowerCase()));
      speak([`Spot ${target.id}. ${spotTitle(target, current.stance)}.`, move, ...lines, 'Press Ready when you are.'].filter(Boolean).join(' '));
    },
    [speak],
  );

  const goTo = useCallback(
    (next: number, current: Session) => {
      setIndex(next);
      setError(null);
      setPhase('spot');
      announce(ANGLE_SPOTS[next], current);
    },
    [announce],
  );

  const carryOn = useCallback(
    (current: Session, from = 0) => {
      const open = nextOpen(from, current);
      const wrapped = open < 0 && from > 0 ? nextOpen(0, current) : open;
      if (wrapped < 0) {
        setPhase('finished');
        speak('Every spot is done. The summary is saved.');
      } else goTo(wrapped, current);
    },
    [goTo, nextOpen, speak],
  );

  const startNew = async (choice: LabStance) => {
    releaseFocus();
    try {
      const created = await post<Session>('start', { date: today(), stance: choice });
      setSession(created);
      carryOn(created);
    } catch (failure) {
      setError(`Could not start: ${(failure as Error).message}`);
    }
  };

  const ready = useCallback(() => {
    releaseFocus();
    setError(null);
    setPhase('running');
    recorder.begin();
  }, [recorder]);

  const skip = useCallback(async () => {
    if (!session) return;
    try {
      const updated = await post<Session>('skip', { session: session.name, spotId: spot.id });
      setSession(updated);
      carryOn(updated, index + 1);
    } catch (failure) {
      setError(`Could not skip: ${(failure as Error).message}`);
    }
  }, [carryOn, index, session, spot.id]);

  /** Drops the take in progress. Every finished spot is already on disk. */
  const pause = useCallback(() => {
    recorder.cancel();
    setPhase('paused');
    speak('Paused. Press Ready to carry on.');
  }, [recorder, speak]);

  // A finished take is scored here, then saved with its score
  const { recording } = recorder;
  useEffect(() => {
    if (phase !== 'running' || !recording || !session) return;
    setPhase('saving');
    const { score, camera } = scoreRecording(recording);
    const row = { spotId: spot.id, stance: session.stance, recordedAt: recording.createdAt, score, camera };
    post<{ path: string; session: Session }>('save', { session: session.name, row, recording })
      .then((data) => {
        setSavedPath(data.path);
        setSession(data.session);
        setPhase('scored');
        speak(
          shove
            ? `Saved. ${score.falsePunches} false punches.`
            : `Saved. Counted ${score.counted} of ${score.expected}. ${score.right} named right. ${score.falsePunches} false.`,
        );
      })
      .catch((failure: Error) => {
        setError(`Not saved: ${failure.message}. Press Redo to film it again.`);
        setPhase('scored');
      });
  }, [phase, recording, session, shove, speak, spot.id]);

  // Space does the big button, from across the room
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!session) return;
      const key = event.key.toLowerCase();
      const space = event.code === 'Space';
      if (space) event.preventDefault();
      if ((phase === 'spot' || phase === 'paused') && space) ready();
      else if (phase === 'spot' && key === 's') void skip();
      else if (phase === 'running' && (key === 'escape' || key === 'p')) pause();
      else if (phase === 'scored' && space) carryOn(session, index + 1);
      else if (phase === 'scored' && key === 'r') ready();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [carryOn, index, pause, phase, ready, session, skip]);

  const row = rows[spot.id];
  const done = session?.rows.length ?? 0;
  const running = phase === 'running' || phase === 'saving';

  return (
    <div
      className="min-h-screen bg-background text-foreground px-4 py-6 md:px-8"
      data-testid="angle-lab"
      data-phase={phase}
      data-spot={spot.id}
      data-stage={recorder.stage}
      data-step-label={recorder.step.label}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
        <h1 className="text-3xl font-black uppercase tracking-wider">Angle lab</h1>
        <p className="text-sm text-muted-foreground break-all">
          {session ? `${stance} · ${done} of ${ANGLE_SPOTS.length} filmed · saves to ${session.folder}` : ''}
          {quick && ' · quick mode'}
        </p>
      </header>

      {error && (
        <p role="alert" className="mb-6 rounded-2xl bg-destructive/20 border border-destructive p-4 text-2xl font-bold">
          {error}
        </p>
      )}

      {phase === 'welcome' && (
        <section className="max-w-3xl space-y-8" data-testid="welcome-screen">
          {session && nextOpen(0, session) >= 0 && (
            <div className="space-y-4">
              <p className="text-4xl font-black">
                Carry on: {done} of {ANGLE_SPOTS.length} spots filmed, {session.stance}.
              </p>
              <button className={primary} onClick={() => (releaseFocus(), carryOn(session))}>
                Carry on
              </button>
            </div>
          )}
          <div className="space-y-4">
            <p className="text-3xl font-black">{session ? 'Or start a new session' : 'Which stance?'}</p>
            <p className="text-xl text-muted-foreground">
              8 spots round you with the laptop on the floor, the same 8 on a chair, then 2 checks: {ANGLE_SPOTS.length} in all, about 75 seconds each. Face the bag at 12 o'clock. Every take saves
              itself, so you can stop and come back any time.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className={session ? secondary : primary} onClick={() => void startNew('orthodox')}>
                Orthodox
              </button>
              <button className={secondary} onClick={() => void startNew('southpaw')}>
                Southpaw
              </button>
            </div>
          </div>
        </section>
      )}

      {session && phase !== 'welcome' && phase !== 'loading' && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <main className="min-w-0">
            {(phase === 'spot' || phase === 'paused') && (
              <section className="grid gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] items-start" data-testid="spot-screen">
                <div className="w-full max-w-[26rem] mx-auto">
                  <SpotDiagram spot={spot} stance={stance} />
                </div>
                <div className="space-y-5 min-w-0">
                  <p className="text-xl uppercase tracking-widest text-muted-foreground">
                    Spot {spot.id} of {ANGLE_SPOTS.length} · {RUN_WORDS[spot.run]}
                  </p>
                  <h2 className="text-5xl font-black leading-tight">{spotTitle(spot, stance)}</h2>
                  {phase === 'paused' && <p className="text-3xl font-bold text-volt">Paused. That take was dropped. Ready films it again.</p>}
                  {phase === 'spot' && moveFromPrevious(spot, ANGLE_SPOTS[index - 1]) && (
                    <p className="text-3xl font-bold text-volt">{moveFromPrevious(spot, ANGLE_SPOTS[index - 1])}</p>
                  )}
                  {spotLines(spot, stance).map((line) => (
                    <p key={line} className="text-3xl font-bold leading-snug">
                      {line}
                    </p>
                  ))}
                  {spot.why && <p className="text-xl text-muted-foreground">{spot.why}</p>}
                  {row && <p className="text-xl text-volt">Already filmed. Ready films it again.</p>}
                  <div className="flex flex-wrap gap-4 pt-2">
                    <button className={primary} onClick={ready}>
                      Ready <span className="text-xl font-bold opacity-70">space</span>
                    </button>
                    <button className={secondary} onClick={() => void skip()}>
                      Skip <span className="text-lg font-bold opacity-60">S</span>
                    </button>
                  </div>
                  <p className="text-lg text-muted-foreground">Ready starts a {quick ? 1 : COUNTDOWN_SECONDS}-second countdown to get to your spot. Close the tab any time: it carries on from here next time.</p>
                </div>
              </section>
            )}

            {/* Always mounted, so the camera has its picture to attach to the moment it starts */}
            <section className={running ? 'space-y-4' : 'hidden'} data-testid="run-screen">
              {recorder.problem ? (
                <div className="rounded-2xl bg-surface-3 p-6">
                  <p className="text-4xl font-black">{CAMERA_MESSAGES[recorder.problem].title}</p>
                  <p className="text-2xl text-muted-foreground mt-2">{CAMERA_MESSAGES[recorder.problem].body}</p>
                </div>
              ) : (
                <div className="relative h-[70vh] rounded-2xl overflow-hidden bg-black">
                  <video ref={recorder.videoRef} playsInline muted className="absolute inset-0 w-full h-full object-contain -scale-x-100" />
                  <canvas ref={recorder.canvasRef} className="absolute inset-0 w-full h-full object-contain -scale-x-100 pointer-events-none" />
                  <div className="absolute inset-x-0 top-0 p-6 bg-gradient-to-b from-black/90 to-transparent text-center">
                    <p className="text-7xl font-black text-volt" data-testid="lab-prompt">
                      {phase === 'saving'
                        ? 'Scoring'
                        : recorder.stage === 'countdown'
                          ? Math.ceil(recorder.remaining)
                          : recorder.stage === 'intro'
                            ? 'Starting camera'
                            : recorder.step.prompt}
                    </p>
                    {recorder.stage === 'recording' && <p className="text-4xl font-bold mt-2">{Math.ceil(recorder.remaining)}s</p>}
                    {recorder.stage === 'ready' && <p className="text-3xl font-bold mt-2 text-muted-foreground">Get ready</p>}
                    {recorder.stage === 'countdown' && (
                      <p className="text-3xl font-bold mt-2">{shove ? 'Shove the bag on Go, then hands up' : 'Get to your spot'}</p>
                    )}
                  </div>
                  {recorder.hud.warning && (
                    <p role="status" className="absolute bottom-4 inset-x-4 rounded-xl bg-black/80 p-3 text-center text-2xl font-bold">
                      {recorder.hud.warning}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-4 items-center">
                <p className="text-2xl font-bold text-muted-foreground">
                  Spot {spot.id} ·{' '}
                  {recorder.stage === 'recording' || recorder.stage === 'ready' ? `step ${recorder.stepIndex + 1} of ${steps.length}` : recorder.stage}
                </p>
                <button className={small} onClick={pause} disabled={phase === 'saving'}>
                  Pause <span className="opacity-60">P</span>
                </button>
              </div>
            </section>

            {phase === 'scored' && (
              <section className="space-y-6" data-testid="score-screen">
                <p className="text-xl uppercase tracking-widest text-muted-foreground">
                  Spot {spot.id} · {spotTitle(spot, stance)}
                </p>
                {row && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4" data-testid="spot-score">
                      {!shove && <Stat value={`${row.score.counted}/${row.score.expected}`} label="Counted" tone="text-volt" />}
                      {!shove && <Stat value={row.score.right} label="Named right" />}
                      {!shove && <Stat value={row.score.wrong} label="Named wrong" />}
                      {!shove && <Stat value={row.score.unnamed} label="No name" />}
                      <Stat value={row.score.falsePunches} label="False punches" tone={row.score.falsePunches > 0 ? 'text-destructive' : 'text-foreground'} />
                      {!shove && <Stat value={row.score.wrongHand} label="Wrong hand" />}
                    </div>
                    <p className="text-3xl font-bold">Camera read: {row.camera.says}</p>
                    {row.camera.advice && <p className="text-2xl text-muted-foreground">It would say: {row.camera.advice}</p>}
                    <p className="text-base text-muted-foreground break-all" data-testid="saved-path">
                      Saved {savedPath || row.file}
                    </p>
                  </>
                )}
                <div className="flex flex-wrap gap-4">
                  <button className={primary} onClick={() => (releaseFocus(), carryOn(session, index + 1))}>
                    Next spot <span className="text-xl font-bold opacity-70">space</span>
                  </button>
                  <button className={secondary} onClick={ready}>
                    Redo <span className="text-lg font-bold opacity-60">R</span>
                  </button>
                </div>
                <p className="text-lg text-muted-foreground">Stopping here is fine: close the tab and it carries on from the next spot.</p>
              </section>
            )}

            {phase === 'finished' && (
              <section className="space-y-6" data-testid="finished-screen">
                <h2 className="text-5xl font-black">All done</h2>
                <p className="text-2xl break-all">The grid, best spots and dead spots are in summary.md in {session.folder}.</p>
                <p className="text-xl text-muted-foreground">Pick any spot on the right to film it again.</p>
              </section>
            )}
          </main>

          <aside aria-label="Spots">
            <SpotGrid stance={stance} current={spot} rows={rows} skipped={skipped} disabled={running} onPick={(target) => (releaseFocus(), goTo(ANGLE_SPOTS.indexOf(target), session))} />
          </aside>
        </div>
      )}
    </div>
  );
}
