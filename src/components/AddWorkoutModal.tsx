import { useState } from 'react';
import { X, Mic, MicOff, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CompletedWorkout, RoundFeedback } from '@/types';
import { useHistoryStore } from '@/stores/historyStore';
import { useUserStore } from '@/stores/userStore';

interface AddWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddWorkoutModal({ isOpen, onClose }: AddWorkoutModalProps) {
  const [mode, setMode] = useState<'basic' | 'advanced'>('basic');
  const [workoutName, setWorkoutName] = useState('');
  const [duration, setDuration] = useState(30); // minutes
  const [notes, setNotes] = useState('');
  const [difficulty, setDifficulty] = useState<'too_easy' | 'just_right' | 'too_hard' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [rounds, setRounds] = useState(6);
  const [roundFeedback, setRoundFeedback] = useState<RoundFeedback[]>([]);

  const addCompletedWorkout = useHistoryStore((state) => state.addCompletedWorkout);
  const addXP = useUserStore((state) => state.addXP);

  const handleRoundRating = (roundNum: number, rating: number) => {
    setRoundFeedback((prev) => {
      const existing = prev.find((r) => r.roundNumber === roundNum);
      if (existing) {
        return prev.map((r) => (r.roundNumber === roundNum ? { ...r, rating } : r));
      }
      return [...prev, { roundNumber: roundNum, rating }];
    });
  };

  const toggleRecording = () => {
    if (!isRecording) {
      // Start recording (mock - would use Web Speech API)
      setIsRecording(true);
      // Simulate stopping after 5 seconds for demo
      setTimeout(() => {
        setIsRecording(false);
        setNotes((prev) => prev + (prev ? ' ' : '') + 'Felt good today, focused on technique.');
      }, 3000);
    } else {
      setIsRecording(false);
    }
  };

  const handleSave = () => {
    const xpEarned = Math.floor((duration / 60) * 10) * 60; // 10 XP per minute
    
    const workout: CompletedWorkout = {
      id: crypto.randomUUID(),
      workoutName: workoutName || 'Manual Entry',
      completedAt: new Date(),
      duration: duration * 60,
      xpEarned,
      difficulty: difficulty || undefined,
      notes: notes || undefined,
      roundFeedback: mode === 'advanced' && roundFeedback.length > 0 ? roundFeedback : undefined,
      isManualEntry: true,
    };

    addCompletedWorkout(workout);
    addXP(xpEarned);
    
    // Reset and close
    setWorkoutName('');
    setDuration(30);
    setNotes('');
    setDifficulty(null);
    setRoundFeedback([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex flex-col">
      <header className="flex items-center justify-between px-4 py-4 border-b border-surface-3">
        <button onClick={onClose} className="text-muted-foreground">
          <X className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-foreground">Log Past Workout</h2>
        <div className="w-6" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('basic')}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              mode === 'basic'
                ? 'bg-volt text-primary-foreground'
                : 'bg-surface-1 text-muted-foreground'
            )}
          >
            Basic
          </button>
          <button
            onClick={() => setMode('advanced')}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              mode === 'advanced'
                ? 'bg-volt text-primary-foreground'
                : 'bg-surface-1 text-muted-foreground'
            )}
          >
            Advanced
          </button>
        </div>

        {/* Workout Name */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Workout Name</label>
          <Input
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            placeholder="e.g., Heavy Bag Session"
            className="bg-surface-1 border-surface-3"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Duration (minutes)</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDuration(Math.max(5, duration - 5))}
              className="w-10 h-10 rounded-lg bg-surface-1 border border-surface-3 flex items-center justify-center"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <span className="text-2xl font-bold text-volt w-16 text-center">{duration}</span>
            <button
              onClick={() => setDuration(duration + 5)}
              className="w-10 h-10 rounded-lg bg-surface-1 border border-surface-3 flex items-center justify-center"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Difficulty Rating */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">How did it feel?</label>
          <div className="flex gap-2">
            {[
              { value: 'too_easy', label: 'Too Easy' },
              { value: 'just_right', label: 'Just Right' },
              { value: 'too_hard', label: 'Too Hard' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDifficulty(opt.value as typeof difficulty)}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                  difficulty === opt.value
                    ? 'bg-volt text-primary-foreground'
                    : 'bg-surface-1 border border-surface-3 text-muted-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced: Round Feedback */}
        {mode === 'advanced' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-muted-foreground">Rate Each Round</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRounds(Math.max(1, rounds - 1))}
                  className="w-6 h-6 rounded bg-surface-2 flex items-center justify-center text-muted-foreground"
                >
                  -
                </button>
                <span className="text-sm font-medium w-8 text-center">{rounds}</span>
                <button
                  onClick={() => setRounds(rounds + 1)}
                  className="w-6 h-6 rounded bg-surface-2 flex items-center justify-center text-muted-foreground"
                >
                  +
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: rounds }, (_, i) => i + 1).map((roundNum) => {
                const feedback = roundFeedback.find((r) => r.roundNumber === roundNum);
                return (
                  <div key={roundNum} className="flex items-center gap-3 bg-surface-1 rounded-lg p-3 border border-surface-3">
                    <span className="text-sm font-medium text-muted-foreground w-8">R{roundNum}</span>
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => handleRoundRating(roundNum, rating)}
                          className={cn(
                            'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
                            feedback?.rating === rating
                              ? 'bg-volt text-primary-foreground'
                              : 'bg-surface-2 text-muted-foreground'
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
          </div>
        )}

        {/* Journal Notes */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Notes</label>
          <div className="relative">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it go? What did you work on?"
              className="w-full h-32 p-3 pr-12 rounded-xl bg-surface-1 border border-surface-3 text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-volt"
            />
            <button
              onClick={toggleRecording}
              className={cn(
                'absolute right-3 bottom-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                isRecording
                  ? 'bg-destructive text-destructive-foreground animate-pulse'
                  : 'bg-surface-2 text-muted-foreground hover:text-foreground'
              )}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          {isRecording && (
            <p className="text-xs text-destructive mt-1 animate-pulse">Recording...</p>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="px-4 py-4 border-t border-surface-3 safe-bottom">
        <Button onClick={handleSave} className="btn-primary-glow w-full">
          Log Workout
        </Button>
      </div>
    </div>
  );
}
