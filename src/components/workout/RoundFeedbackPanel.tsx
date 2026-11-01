import { RoundFeedback } from '@/types';
import { cn } from '@/lib/utils';

interface RoundFeedbackPanelProps {
  roundCount: number;
  roundFeedback: RoundFeedback[];
  onRoundRating: (roundNum: number, rating: number) => void;
}

/** The judges' scorecard: one to five, round by round. */
export function RoundFeedbackPanel({ roundCount, roundFeedback, onRoundRating }: RoundFeedbackPanelProps) {
  return (
    <div>
      <p className="fx mb-1 text-3xl">Rate Each Round</p>
      {Array.from({ length: roundCount }, (_, i) => i + 1).map((roundNum) => {
        const feedback = roundFeedback.find((r) => r.roundNumber === roundNum);
        return (
          <div key={roundNum} className="grid grid-cols-[2.5rem_1fr] items-center gap-1 border-b border-surface-2 py-1.5">
            <span className="fx text-2xl">R{roundNum}</span>
            <div className="score-five">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  aria-label={`Round ${roundNum}, ${rating}`}
                  aria-pressed={feedback?.rating === rating}
                  onClick={() => onRoundRating(roundNum, rating)}
                  className={cn('plate fx h-11 text-2xl', feedback?.rating === rating ? 'plate-lime' : 'plate-graphite text-muted-foreground')}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
