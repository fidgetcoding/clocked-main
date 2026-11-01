import { FIX_ADVICE, PUNCH_LABELS, PUNCH_NUMBERS, PUNCH_ORDER, formatClock } from '@/lib/punch/round';
import type { PunchLog } from '@/lib/punch/sessionLog';
import type { FormIssue } from '@/lib/punch/types';

interface PunchLogViewProps {
  log: PunchLog;
}

/** What the camera logged in a session: punches by type and hand, rounds, combos and form cues. */
export function PunchLogView({ log }: PunchLogViewProps) {
  const types = PUNCH_ORDER.filter((punch) => log.counts[punch] > 0);
  const cues = (Object.entries({ ...log.idleCues, ...log.cues }) as [FormIssue, number][]).sort((a, b) => b[1] - a[1]);
  const combos = new Map<string, number>();
  for (const combo of log.combos) {
    const name = combo.map((punch) => PUNCH_NUMBERS[punch]).join('-');
    combos.set(name, (combos.get(name) ?? 0) + 1);
  }
  const topCombos = [...combos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="space-y-2 text-left" data-testid="punch-log">
      <p className="text-sm font-bold text-foreground">
        {log.punches.length} {log.punches.length === 1 ? 'punch' : 'punches'}: {log.hands.lead} lead, {log.hands.rear} rear
      </p>
      <ul className="grid grid-cols-2 gap-x-3 text-xs text-muted-foreground" data-testid="punch-log-types">
        {types.map((punch) => (
          <li key={punch} className="flex justify-between">
            <span>{PUNCH_LABELS[punch]}</span>
            <span className="font-bold text-foreground">{log.counts[punch]}</span>
          </li>
        ))}
      </ul>
      {log.rounds.length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="punch-log-rounds">
          {log.rounds.length} {log.rounds.length === 1 ? 'round' : 'rounds'}:{' '}
          {log.rounds.map((round) => `${formatClock(round.start)} (${round.punches})`).join(', ')}
        </p>
      )}
      {topCombos.length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="punch-log-combos">
          {log.combos.length} {log.combos.length === 1 ? 'combo' : 'combos'}. Most thrown:{' '}
          {topCombos.map(([name, count]) => `${name} (${count})`).join(', ')}
        </p>
      )}
      {cues.length > 0 && (
        <ul className="text-xs text-muted-foreground" data-testid="punch-log-cues">
          {cues.map(([issue, count]) => (
            <li key={issue}>
              {FIX_ADVICE[issue]} ({count})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
