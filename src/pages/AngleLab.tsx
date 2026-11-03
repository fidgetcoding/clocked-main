import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SpotDiagram } from '@/components/lab/SpotDiagram';
import { useRecordSession } from '@/hooks/useRecordSession';
import { scoreRecording } from '@/lib/lab/angleScore';
import { ANGLE_SPOTS, moveFromPrevious, spotLines, type AngleSpot, type LabRow, type LabStance } from '@/lib/lab/angleSpots';
import { CAMERA_MESSAGES } from '@/lib/punch/framing';
import { RECORD_STEPS, type RecordStep } from '@/lib/punch/recording';

// Dev only (see App.tsx): films a real bag from each camera spot in turn and saves every take to disk.

type Phase = 'stance' | 'spot' | 'running' | 'saving' | 'scored' | 'finished';

const SHOVE_STEPS: RecordStep[] = [{ label: 'guard', prompt: 'Hands up. No punches.', expected: 0, seconds: 10 }];
// ?quick=1 runs every step in a few seconds, for trying the lab out and for the browser test
const QUICK_STEPS: RecordStep[] = RECORD_STEPS.map((step) => ({ ...step, seconds: 4 }));
const QUICK_SHOVE: RecordStep[] = SHOVE_STEPS.map((step) => ({ ...step, seconds: 4 }));

const today = () => new Date().toLocaleDateString('en-CA');

const big = 'rounded-2xl font-black uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-volt';
const primary = `${big} bg-volt text-black hover:bg-volt/90 h-24 px-10 text-4xl`;
const secondary = `${big} bg-surface-3 text-foreground hover:bg-surface-3/80 h-24 px-8 text-3xl`;

const releaseFocus = () => (document.activeElement as HTMLElement | null)?.blur();

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
  const date = useMemo(today, []);
  const [stance, setStance] = useState<LabStance>('orthodox');
  const [phase, setPhase] = useState<Phase>('stance');
  const [index, setIndex] = useState(0);
  const [rows, setRows] = useState<Record<string, LabRow>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [folder, setFolder] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  const spot = ANGLE_SPOTS[index];
  const shove = spot.set === 'shove';
  const steps = shove ? (quick ? QUICK_SHOVE : SHOVE_STEPS) : quick ? QUICK_STEPS : RECORD_STEPS;
  const session = useRecordSession({
    stance,
    steps,
    getReadyMs: quick ? 600 : undefined,
    countdownSeconds: quick ? 1 : 10,
    countdownLine: shove ? 'Get to your spot. Shove the bag hard when I say go, then hands up.' : 'Get to your spot. Starting in 10 seconds.',
  });
  const { speak } = session;

  // What's already on disk for today, so a reload carries on
  useEffect(() => {
    fetch(`/__lab/angles/session?date=${date}`)
      .then((res) => res.json())
      .then((data: { folder: string; rows: LabRow[] }) => {
        setFolder(data.folder);
        setRows(Object.fromEntries(data.rows.map((row) => [`${row.spotId}-${row.stance}`, row])));
      })
      .catch(() => setError('The lab needs the dev server: run npm run lab:angles.'));
  }, [date]);

  const rowFor = useCallback((target: AngleSpot) => rows[`${target.id}-${stance}`], [rows, stance]);

  const announce = useCallback(
    (target: AngleSpot) => {
      const move = moveFromPrevious(target, ANGLE_SPOTS[ANGLE_SPOTS.indexOf(target) - 1]);
      speak([`Spot ${target.id}. ${target.title}.`, move, ...spotLines(target, stance), 'Press space when you are ready.'].filter(Boolean).join(' '));
    },
    [speak, stance],
  );

  const goTo = useCallback(
    (next: number) => {
      setIndex(next);
      setError(null);
      setPhase('spot');
      announce(ANGLE_SPOTS[next]);
    },
    [announce],
  );

  /** The next spot not yet filmed or skipped, after this one. */
  const advance = useCallback(
    (from: number, skip: Set<string>) => {
      for (let i = from + 1; i < ANGLE_SPOTS.length; i += 1) {
        const candidate = ANGLE_SPOTS[i];
        if (!rowFor(candidate) && !skip.has(candidate.id)) return goTo(i);
      }
      setPhase('finished');
      speak('That was the last spot. The summary is saved.');
    },
    [goTo, rowFor, speak],
  );

  const chooseStance = (choice: LabStance) => {
    setStance(choice);
    releaseFocus();
    // Start at the first spot not yet filmed in this stance today
    const first = ANGLE_SPOTS.findIndex((candidate) => !rows[`${candidate.id}-${choice}`]);
    if (first < 0) setPhase('finished');
    else {
      setIndex(first);
      setPhase('spot');
    }
  };

  // Announced once the stance has applied, so the sides are named right
  const announcedRef = useRef(false);
  useEffect(() => {
    if (phase === 'spot' && !announcedRef.current) {
      announcedRef.current = true;
      announce(spot);
    }
  }, [announce, phase, spot]);

  const ready = useCallback(() => {
    releaseFocus();
    setError(null);
    setPhase('running');
    session.begin();
  }, [session]);

  const skip = useCallback(() => {
    const next = new Set(skipped).add(spot.id);
    setSkipped(next);
    advance(index, next);
  }, [advance, index, skipped, spot.id]);

  const stopRun = useCallback(() => {
    session.cancel();
    setPhase('spot');
  }, [session]);

  // A finished take is scored here, then saved with its score
  const { recording } = session;
  useEffect(() => {
    if (phase !== 'running' || !recording) return;
    setPhase('saving');
    const { score, camera } = scoreRecording(recording);
    const row = { spotId: spot.id, stance, recordedAt: recording.createdAt, score, camera };
    fetch('/__lab/angles/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, row, recording }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
        return data as { path: string; rows: LabRow[] };
      })
      .then((data) => {
        setSavedPath(data.path);
        setRows(Object.fromEntries(data.rows.map((saved) => [`${saved.spotId}-${saved.stance}`, saved])));
        setPhase('scored');
        speak(
          shove
            ? `Saved. ${score.falsePunches} false punches.`
            : `Saved. Counted ${score.counted} of ${score.expected}. ${score.right} named right. ${score.falsePunches} false.`,
        );
      })
      .catch((failure: Error) => {
        setError(`Not saved: ${failure.message}`);
        setPhase('scored');
      });
  }, [date, phase, recording, shove, speak, spot.id, stance]);

  // Space does the big button, from across the room
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.code === 'Space') event.preventDefault();
      if (phase === 'spot' && event.code === 'Space') ready();
      else if (phase === 'spot' && key === 's') skip();
      else if (phase === 'running' && key === 'escape') stopRun();
      else if (phase === 'scored' && event.code === 'Space') advance(index, skipped);
      else if (phase === 'scored' && key === 'r') ready();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, index, phase, ready, skip, skipped, stopRun]);

  const row = rowFor(spot);
  const lines = spotLines(spot, stance);
  const move = moveFromPrevious(spot, ANGLE_SPOTS[index - 1]);

  return (
    <div
      className="min-h-screen bg-background text-foreground px-4 py-6 md:px-8"
      data-testid="angle-lab"
      data-phase={phase}
      data-spot={spot.id}
      data-stage={session.stage}
      data-step-label={session.step.label}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
        <h1 className="text-3xl font-black uppercase tracking-wider">Angle lab</h1>
        <p className="text-sm text-muted-foreground break-all">
          {stance} · saves to {folder || '…'}
          {quick && ' · quick mode'}
        </p>
      </header>

      {error && (
        <p role="alert" className="mb-6 rounded-2xl bg-destructive/20 border border-destructive p-4 text-2xl font-bold">
          {error}
        </p>
      )}

      {phase === 'stance' && (
        <section className="max-w-3xl space-y-8">
          <p className="text-4xl font-black">Which stance?</p>
          <p className="text-xl text-muted-foreground">
            {ANGLE_SPOTS.length} spots, about 4 minutes each. Face the bag at 12 o'clock. Every take saves itself.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className={primary} onClick={() => chooseStance('orthodox')}>
              Orthodox
            </button>
            <button className={secondary} onClick={() => chooseStance('southpaw')}>
              Southpaw
            </button>
          </div>
        </section>
      )}

      {phase !== 'stance' && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <main className="min-w-0">
            {phase === 'spot' && (
              <section className="grid gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] items-start" data-testid="spot-screen">
                <div className="w-full max-w-[26rem] mx-auto">
                  <SpotDiagram spot={spot} stance={stance} />
                </div>
                <div className="space-y-5 min-w-0">
                  <p className="text-xl uppercase tracking-widest text-muted-foreground">
                    Spot {spot.id} · {index + 1} of {ANGLE_SPOTS.length}
                  </p>
                  <h2 className="text-5xl font-black leading-tight">{spot.title}</h2>
                  {move && <p className="text-3xl font-bold text-volt">{move}</p>}
                  {lines.map((line) => (
                    <p key={line} className="text-3xl font-bold leading-snug">
                      {line}
                    </p>
                  ))}
                  <p className="text-xl text-muted-foreground">{spot.why}</p>
                  {row && <p className="text-xl text-volt">Already filmed today. Ready films it again.</p>}
                  <div className="flex flex-wrap gap-4 pt-2">
                    <button className={primary} onClick={ready}>
                      Ready <span className="text-xl font-bold opacity-70">space</span>
                    </button>
                    <button className={secondary} onClick={skip}>
                      Skip <span className="text-lg font-bold opacity-60">S</span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Always mounted, so the camera has its picture to attach to the moment it starts */}
            <section className={phase === 'running' || phase === 'saving' ? 'space-y-4' : 'hidden'} data-testid="run-screen">
              {session.problem ? (
                <div className="rounded-2xl bg-surface-3 p-6">
                  <p className="text-4xl font-black">{CAMERA_MESSAGES[session.problem].title}</p>
                  <p className="text-2xl text-muted-foreground mt-2">{CAMERA_MESSAGES[session.problem].body}</p>
                </div>
              ) : (
                <div className="relative h-[70vh] rounded-2xl overflow-hidden bg-black">
                  <video ref={session.videoRef} playsInline muted className="absolute inset-0 w-full h-full object-contain -scale-x-100" />
                  <canvas ref={session.canvasRef} className="absolute inset-0 w-full h-full object-contain -scale-x-100 pointer-events-none" />
                  <div className="absolute inset-x-0 top-0 p-6 bg-gradient-to-b from-black/90 to-transparent text-center">
                    <p className="text-7xl font-black text-volt" data-testid="lab-prompt">
                      {phase === 'saving'
                        ? 'Scoring'
                        : session.stage === 'countdown'
                          ? Math.ceil(session.remaining)
                          : session.stage === 'intro'
                            ? 'Starting camera'
                            : session.step.prompt}
                    </p>
                    {session.stage === 'recording' && <p className="text-4xl font-bold mt-2">{Math.ceil(session.remaining)}s</p>}
                    {session.stage === 'ready' && <p className="text-3xl font-bold mt-2 text-muted-foreground">Get ready</p>}
                    {session.stage === 'countdown' && (
                      <p className="text-3xl font-bold mt-2">{shove ? 'Shove the bag on Go, then hands up' : 'Get to your spot'}</p>
                    )}
                  </div>
                  {session.hud.warning && (
                    <p role="status" className="absolute bottom-4 inset-x-4 rounded-xl bg-black/80 p-3 text-center text-2xl font-bold">
                      {session.hud.warning}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-4 items-center">
                <p className="text-2xl font-bold text-muted-foreground">
                  Spot {spot.id} · {session.stage === 'recording' || session.stage === 'ready' ? `step ${session.stepIndex + 1} of ${steps.length}` : session.stage}
                </p>
                <button className={`${big} bg-surface-3 h-14 px-6 text-xl`} onClick={stopRun} disabled={phase === 'saving'}>
                  Stop <span className="opacity-60">esc</span>
                </button>
              </div>
            </section>

            {phase === 'scored' && (
              <section className="space-y-6" data-testid="score-screen">
                <p className="text-xl uppercase tracking-widest text-muted-foreground">Spot {spot.id} · {spot.title}</p>
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
                  <button className={primary} onClick={() => advance(index, skipped)}>
                    Next spot <span className="text-xl font-bold opacity-70">space</span>
                  </button>
                  <button className={secondary} onClick={ready}>
                    Redo <span className="text-lg font-bold opacity-60">R</span>
                  </button>
                </div>
              </section>
            )}

            {phase === 'finished' && (
              <section className="space-y-6" data-testid="finished-screen">
                <h2 className="text-5xl font-black">All done</h2>
                <p className="text-2xl">The table is in summary.md in {folder}.</p>
                <p className="text-xl text-muted-foreground">Pick any spot on the right to film it again.</p>
              </section>
            )}
          </main>

          <aside aria-label="Spots" className="space-y-2">
            {ANGLE_SPOTS.map((candidate, i) => {
              const done = rowFor(candidate);
              const state = done ? 'done' : skipped.has(candidate.id) ? 'skipped' : 'todo';
              return (
                <button
                  key={candidate.id}
                  data-spot-state={state}
                  disabled={phase === 'running' || phase === 'saving'}
                  onClick={() => {
                    releaseFocus();
                    goTo(i);
                  }}
                  className={`w-full text-left rounded-xl px-4 py-3 border ${i === index ? 'border-volt' : 'border-surface-3'} disabled:opacity-60`}
                >
                  <span className="block text-lg font-bold">
                    {candidate.id}. {candidate.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {done ? `${done.score.counted}/${done.score.expected} counted · ${done.score.falsePunches} false` : state === 'skipped' ? 'Skipped' : 'Not filmed'}
                  </span>
                </button>
              );
            })}
          </aside>
        </div>
      )}
    </div>
  );
}
