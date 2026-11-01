import { cueFor, PUNCH_LABELS, PUNCH_ORDER, punchWord } from '@/lib/punch/round';
import { cueOnPunch, topFixOf, type PunchLog } from '@/lib/punch/sessionLog';
import type { FormIssue } from '@/lib/punch/types';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

const typeCounts = (log: PunchLog) =>
  PUNCH_ORDER.filter((punch) => log.totals.byType[punch] > 0).map((punch) => ({
    punch,
    label: PUNCH_LABELS[punch],
    count: log.totals.byType[punch],
  }));

const Stat = ({ value, label, testId }: { value: string | number; label: string; testId?: string }) => (
  <div className="text-center">
    <p className="text-lg font-bold text-volt" data-testid={testId}>
      {value}
    </p>
    <p className="text-[11px] text-muted-foreground">{label}</p>
  </div>
);

const TypeChips = ({ log }: { log: PunchLog }) => (
  <div className="flex flex-wrap justify-center gap-1">
    {typeCounts(log).map(({ punch, label, count }) => (
      <span key={punch} data-testid={`log-type-${punch}`} className="text-xs bg-surface-2 rounded px-2 py-0.5 text-foreground">
        {label} {count}
      </span>
    ))}
  </div>
);

/** What the camera has logged so far, while the session runs. */
export const PunchLogLive = ({ log, lastCue }: { log: PunchLog; lastCue: string | null }) => {
  const latest = log.punches[log.punches.length - 1];
  const lastCombo = log.combos[log.combos.length - 1];
  return (
    <div data-testid="punch-log-live" className="w-full max-w-sm mt-6 p-3 rounded-xl bg-surface-1 border border-surface-3 space-y-2">
      <div className="grid grid-cols-4 gap-1">
        <Stat value={log.totals.punches} label="Punches" testId="log-live-total" />
        <Stat value={log.totals.byHand.lead} label="Lead" testId="log-live-lead" />
        <Stat value={log.totals.byHand.rear} label="Rear" testId="log-live-rear" />
        <Stat value={log.rounds.length} label="Round" testId="log-live-round" />
      </div>
      <TypeChips log={log} />
      <p className="text-xs text-center text-muted-foreground min-h-4" data-testid="log-live-latest">
        {latest ? `${PUNCH_LABELS[latest.punch]}, ${latest.hand} hand, at ${clock(latest.t / 1000)}` : 'Waiting for your first punch'}
        {lastCombo && ` · Last combo ${lastCombo.sequence}`}
        {lastCue && ` · ${lastCue}`}
      </p>
    </div>
  );
};

/** The whole record of a finished session, on the summary screen and in history. */
export const PunchLogDetails = ({ log, className }: { log: PunchLog; className?: string }) => {
  const { totals } = log;
  const topFix = topFixOf(totals);
  const cues = Object.entries(totals.cues) as [FormIssue, number][];
  return (
    <div data-testid="punch-log" className={className}>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat value={totals.punches} label={punchWord(totals.punches)} testId="log-total" />
        <Stat value={totals.cleanPercent === null ? '-' : `${totals.cleanPercent}%`} label="clean" testId="log-clean" />
        <Stat value={clock(log.durationSeconds)} label="duration" testId="log-duration" />
        <Stat value={totals.byHand.lead} label="lead hand" testId="log-lead" />
        <Stat value={totals.byHand.rear} label="rear hand" testId="log-rear" />
        <Stat value={log.rounds.length} label={log.rounds.length === 1 ? 'round' : 'rounds'} testId="log-rounds" />
        <Stat value={totals.combos} label={totals.combos === 1 ? 'combo' : 'combos'} testId="log-combos" />
        <Stat value={totals.longestCombo} label="longest combo" testId="log-longest" />
        <Stat value={cues.reduce((sum, [, count]) => sum + count, 0)} label="form cues" testId="log-cue-count" />
      </div>

      <TypeChips log={log} />

      {totals.punches === 0 && (
        <p className="text-xs text-center text-muted-foreground">The camera was on but didn't see any punches.</p>
      )}
      {topFix && <p className="text-xs text-center text-muted-foreground mt-2">{topFix.advice}</p>}

      {log.rounds.length > 0 && (
        <details className="mt-3 text-left" data-testid="log-rounds-list">
          <summary className="text-xs text-muted-foreground cursor-pointer">Rounds</summary>
          <ul className="mt-1 space-y-0.5 text-xs text-foreground">
            {log.rounds.map((round) => (
              <li key={round.number}>
                Round {round.number}: {clock(round.startSeconds)} to {clock(round.endSeconds ?? log.durationSeconds)}, {round.punches}{' '}
                {punchWord(round.punches)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {log.combos.length > 0 && (
        <details className="mt-2 text-left" data-testid="log-combos-list">
          <summary className="text-xs text-muted-foreground cursor-pointer">Combos</summary>
          <ul className="mt-1 space-y-0.5 text-xs text-foreground">
            {log.combos.map((combo) => (
              <li key={combo.t}>
                {clock(combo.t / 1000)}: {combo.sequence}
              </li>
            ))}
          </ul>
        </details>
      )}

      {cues.length > 0 && (
        <details className="mt-2 text-left" data-testid="log-cues-list">
          <summary className="text-xs text-muted-foreground cursor-pointer">Form cues</summary>
          <ul className="mt-1 space-y-0.5 text-xs text-foreground">
            {log.cues.map((cue) => (
              <li key={`idle-${cue.t}-${cue.issue}`}>
                {clock(cue.t / 1000)}: {cueFor(cue.issue, cue.hand)}
              </li>
            ))}
            {log.punches
              .filter((punch) => punch.issues.length > 0)
              .map((punch) => (
                <li key={`punch-${punch.t}`}>
                  {clock(punch.t / 1000)}, {PUNCH_LABELS[punch.punch]}: {punch.issues.map((issue) => cueOnPunch(issue, punch)).join(', ')}
                </li>
              ))}
          </ul>
        </details>
      )}

      {log.punches.length > 0 && (
        <details className="mt-2 text-left" data-testid="log-punches-list">
          <summary className="text-xs text-muted-foreground cursor-pointer">Every punch</summary>
          <ul className="mt-1 space-y-0.5 text-xs text-foreground max-h-48 overflow-y-auto">
            {log.punches.map((punch) => (
              <li key={punch.t}>
                {clock(punch.t / 1000)}: {PUNCH_LABELS[punch.punch]}, {punch.hand} hand
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
