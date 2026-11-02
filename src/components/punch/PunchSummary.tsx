import { BroadcastPage, FitText, Plate } from '@/components/broadcast';
import { Button } from '@/components/ui/button';
import { formatClock, PUNCH_LABELS, PUNCH_ORDER, punchWord, type RoundSummary } from '@/lib/punch/round';

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
  const top = Math.max(1, ...thrown.map((punch) => summary.counts[punch]));

  return (
    <BroadcastPage show="Punch Check" className="pb-6">
      <div data-testid="punch-summary">
        <div role="heading" aria-level={1} className="fx mx-4 mt-3 h-20">
          <FitText className="h-full" max={96}>ROUND DONE</FitText>
        </div>

        <div className="mt-3 grid grid-cols-3 border-y border-surface-3 py-2 text-center">
          <div>
            <p className="fx text-6xl text-volt" data-testid="summary-total">{summary.total}</p>
            <p className="lab">{punchWord(summary.total)}</p>
          </div>
          <div>
            <p className="fx text-6xl" data-testid="summary-clean">{summary.cleanPercent === null ? '-' : `${summary.cleanPercent}%`}</p>
            <p className="lab">Clean</p>
          </div>
          <div>
            <p className="fx text-6xl">{formatClock(seconds)}</p>
            <p className="lab">Time</p>
          </div>
        </div>

        {summary.total === 0 ? (
          <p className="mt-3 px-4 text-lg">
            No punches spotted. Check that your head, hands and hips are in the picture, 6 to 10 feet from the camera,
            and that the room is well lit.
          </p>
        ) : (
          <div className="mt-3 space-y-1 px-4" data-testid="summary-counts">
            {thrown.map((punch) => (
              <div key={punch} className="fx grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2.5 text-2xl">
                <span className="whitespace-nowrap">{punch === 'punch' ? 'Not sure which' : PUNCH_LABELS[punch]}</span>
                <i className="block h-4 -skew-x-[14deg] bg-volt" style={{ width: `${(summary.counts[punch] / top) * 100}%` }} />
                <em className="text-right not-italic">{summary.counts[punch]}</em>
              </div>
            ))}
          </div>
        )}

        {summary.topFix && (
          <div className="mt-4" data-testid="summary-fix">
            <Plate tone="red" bleed="left" className="h-9 w-fit justify-start pl-4 pr-6 text-[1.75rem]">Top fix</Plate>
            <p className="fx mt-2 px-4 text-3xl">{summary.topFix.advice}</p>
            <p className="lab mt-1 px-4">Flagged {summary.topFix.count === 1 ? 'once' : `${summary.topFix.count} times`} this round</p>
          </div>
        )}

        <p className="mt-4 px-4 text-sm text-muted-foreground">
          A form guide from one camera angle, so some calls will be wrong. It can't judge your power, and it's no
          replacement for a coach.
        </p>

        <div className="mt-4 space-y-3 px-5">
          {logged ? (
            <p className="fx text-center text-3xl text-volt">Saved to your workout log</p>
          ) : (
            <Button onClick={onLog} disabled={logging || summary.total === 0} size="lg" className="w-full text-3xl">
              Save to workout log
            </Button>
          )}
          {logFailed && <p className="text-center text-base text-alert-red">Couldn't save that. Try again.</p>}
          <div className="flex gap-4">
            <Button onClick={onAgain} variant="secondary" className="flex-1">Go again</Button>
            <Button onClick={onHome} variant="secondary" className="flex-1">Back to Home</Button>
          </div>
        </div>
      </div>
    </BroadcastPage>
  );
}
