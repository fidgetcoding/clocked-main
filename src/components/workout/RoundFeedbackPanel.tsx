import { cn } from '@/lib/utils';
import { RoundFeedback } from '@/types';

interface RoundFeedbackPanelProps {
  roundCount: number;
  roundFeedback: RoundFeedback[];
  onRoundRating: (roundNum: number, rating: number) => void;
}

export function RoundFeedbackPanel({ 
  roundCount, 
  roundFeedback, 
  onRoundRating 
}: RoundFeedbackPanelProps) {
  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      <label className="text-sm text-muted-foreground mb-2 block">Rate Each Round</label>
      {Array.from({ length: roundCount }, (_, i) => i + 1).map((roundNum) => {
        const feedback = roundFeedback.find((r) => r.roundNumber === roundNum);
        return (
          <div 
            key={roundNum} 
            className="flex items-center gap-3 bg-surface-1 rounded-lg p-2 border border-surface-3"
          >
            <span className="text-sm font-medium text-muted-foreground w-8">R{roundNum}</span>
            <div className="flex gap-1 flex-1">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => onRoundRating(roundNum, rating)}
                  className={cn(
                    'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
                    feedback?.rating === rating
                      ? 'bg-volt text-primary-foreground'
                      : 'bg-surface-2 text-muted-foreground hover:bg-surface-3'
                  )}
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
