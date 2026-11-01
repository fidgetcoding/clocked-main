import { Button } from '@/components/ui/button';
import { formatClock, PUNCH_LABELS, PUNCH_ORDER, type RoundSummary } from '@/lib/punch/round';

interface PunchSummaryProps {
  summary: RoundSummary;
  seconds: number;
  logged: boolean;
  logging: boolean;
  logFailed: boolean;
  onLog: () => void;
  onAgain: () => void;
  onHome: () => void;
}

export function PunchSummary({ summary, seconds, logged, logging, logFailed, onLog, onAgain, onHome }: PunchSummaryProps) {
  const thrown = PUNCH_ORDER.filter((punch) => summary.counts[punch] > 0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-background" data-testid="punch-summary">
      <h1 className="text-3xl font-black text-foreground mb-2">ROUND DONE</h1>
      <p className="text-muted-foreground mb-6">Punch Check</p>

      <div className="grid grid-cols-3 gap-3 mb-4 w-full max-w-sm">
        <div className="card-workout text-center">
          <p className="text-2xl font-bold text-volt" data-testid="summary-total">{summary.total}</p>
          <p className="text-sm text-muted-foreground">Punches</p>
        </div>
        <div className="card-workout text-center">
          <p className="text-2xl font-bold text-volt" data-testid="summary-clean">
            {summary.cleanPercent === null ? '-' : `${summary.cleanPercent}%`}
          </p>
          <p className="text-sm text-muted-foreground">Clean</p>
        </div>
        <div className="card-workout text-center">
          <p className="text-2xl font-bold text-volt">{formatClock(seconds)}</p>
          <p className="text-sm text-muted-foreground">Time</p>
        </div>
      </div>

      {summary.total === 0 ? (
        <div className="card-workout w-full max-w-sm mb-4">
          <p className="text-sm text-foreground">
            No punches spotted. Check that your head, hands and hips are in the picture, 6 to 8 feet from the camera,
            and that the room is well lit.
          </p>
        </div>
      ) : (
        <div className="card-workout w-full max-w-sm mb-4 space-y-1" data-testid="summary-counts">
          {thrown.map((punch) => (
            <div key={punch} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{punch === 'punch' ? 'Not sure which' : PUNCH_LABELS[punch]}</span>
              <span className="font-bold text-foreground">{summary.counts[punch]}</span>
            </div>
          ))}
        </div>
      )}

      {summary.topFix && (
        <div className="card-workout w-full max-w-sm mb-4" data-testid="summary-fix">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Top fix</p>
          <p className="text-sm font-semibold text-foreground">{summary.topFix.advice}</p>
          <p className="text-xs text-muted-foreground mt-1">Flagged {summary.topFix.count} times this round</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground w-full max-w-sm mb-6">
        A form guide from one camera angle, so some calls will be wrong. It can't judge your power, and it's no
        replacement for a coach.
      </p>

      <div className="w-full max-w-sm space-y-3">
        {logged ? (
          <div className="card-workout text-center">
            <p className="text-volt font-semibold">Saved to your workout log</p>
          </div>
        ) : (
          <Button onClick={onLog} disabled={logging || summary.total === 0} className="btn-primary-glow w-full">
            Save to workout log
          </Button>
        )}
        {logFailed && <p className="text-sm text-destructive text-center">Couldn't save that. Try again.</p>}
        <Button onClick={onAgain} variant="outline" className="w-full bg-surface-1 border-surface-3">
          Go again
        </Button>
        <Button onClick={onHome} variant="outline" className="w-full bg-surface-1 border-surface-3">
          Back to Home
        </Button>
      </div>
    </div>
  );
}
