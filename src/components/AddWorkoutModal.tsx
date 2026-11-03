import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FitText, MicIcon, OnAir, ScoreBug, StopIcon } from '@/components/broadcast';
import { cn } from '@/lib/utils';
import { RoundFeedback } from '@/types';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { useUserStore } from '@/stores/userStore';
import { useProfile } from '@/hooks/useProfile';
import { useDictation } from '@/hooks/useDictation';
import { countWorkoutTotals } from '@/lib/workoutTracking';

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
  const [rounds, setRounds] = useState(6);
  const [roundFeedback, setRoundFeedback] = useState<RoundFeedback[]>([]);

  const { addHistoryEntry } = useWorkoutHistory();
  const addLocalXP = useUserStore((state) => state.addXP);
  const { profile, addXP: addProfileXP, updateProfile } = useProfile();

  const handleRoundRating = (roundNum: number, rating: number) => {
    setRoundFeedback((prev) => {
      const existing = prev.find((r) => r.roundNumber === roundNum);
      if (existing) {
        return prev.map((r) => (r.roundNumber === roundNum ? { ...r, rating } : r));
      }
      return [...prev, { roundNumber: roundNum, rating }];
    });
  };

  const dictation = useDictation((text) => setNotes((prev) => prev + (prev ? ' ' : '') + text));

  const handleSave = () => {
    // Use proper XP rate: ~0.25 XP per second for general active work = 15 XP per minute
    const xpEarned = Math.floor(duration * 15);
    
    addHistoryEntry.mutate({
      workout_id: null,
      workout_name: workoutName || 'Manual Entry',
      completed_at: new Date().toISOString(),
      duration: duration * 60,
      xp_earned: xpEarned,
      difficulty: difficulty || null,
      notes: notes || null,
      round_feedback: mode === 'advanced' && roundFeedback.length > 0 ? roundFeedback : [],
      is_manual_entry: true,
    }, {
      onSuccess: () => {
        // Award XP to both local store (for UI) and database (for persistence)
        addLocalXP(xpEarned);
        addProfileXP.mutate(xpEarned);
        // Counts toward the Workouts total like any other session. A past workout leaves the streak alone.
        if (profile) {
          countWorkoutTotals(profile.user_id, profile)
            .then((totals) => updateProfile.mutate(totals))
            .catch((error) => console.error('Failed to update the workout count:', error));
        }
        
        // Reset and close
        setWorkoutName('');
        setDuration(30);
        setNotes('');
        setDifficulty(null);
        setRoundFeedback([]);
        dictation.stop();
        onClose();
      },
    });
  };

  if (!isOpen) return null;

  const option = (on: boolean) => cn('plate fx h-11 text-xl', on ? 'plate-white' : 'plate-graphite');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-clip bg-background">
      <div className="mx-auto flex min-h-full max-w-[46rem] flex-col">
        <div className="flex items-center justify-between gap-3 pt-[max(0.625rem,env(safe-area-inset-top))]">
          <ScoreBug mid={<><span className="max-[359px]:hidden">Add to the record</span><span className="min-[360px]:hidden">Record</span></>} className="min-w-0" />
          <button
            type="button"
            aria-label="Close"
            onClick={() => { dictation.stop(); onClose(); }}
            className="plate plate-graphite mr-4 h-11 w-12 shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 pb-4 pt-3">
          <div className="px-4">
            <h2 className="fx"><FitText className="h-14" max={72}>Log Past Workout</FitText></h2>
          </div>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-4 px-5">
            <button type="button" aria-pressed={mode === 'basic'} onClick={() => setMode('basic')} className={option(mode === 'basic')}>
              Basic
            </button>
            <button type="button" aria-pressed={mode === 'advanced'} onClick={() => setMode('advanced')} className={option(mode === 'advanced')}>
              Advanced
            </button>
          </div>

          {/* Workout Name */}
          <div className="px-4">
            <label htmlFor="log-name" className="lab block">Workout Name</label>
            <Input
              id="log-name"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="e.g., Heavy Bag Session"
              className="h-12 text-xl"
            />
          </div>

          {/* Duration */}
          <div className="px-4">
            <span className="lab block">Duration (minutes)</span>
            <div className="mt-1 flex items-center gap-4">
              <b className="fx w-28 text-8xl text-volt">{duration}</b>
              <button
                type="button"
                aria-label="5 minutes less"
                onClick={() => setDuration(Math.max(5, duration - 5))}
                className="plate plate-graphite h-12 w-14"
              >
                <ChevronDown className="size-5" />
              </button>
              <button
                type="button"
                aria-label="5 minutes more"
                onClick={() => setDuration(duration + 5)}
                className="plate plate-graphite h-12 w-14"
              >
                <ChevronUp className="size-5" />
              </button>
            </div>
          </div>

          {/* Difficulty Rating */}
          <div>
            <span className="lab block px-4">How did it feel?</span>
            <div className="mt-2 grid grid-cols-3 gap-4 px-5">
              {[
                { value: 'too_easy', label: 'Too Easy' },
                { value: 'just_right', label: 'Just Right' },
                { value: 'too_hard', label: 'Too Hard' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  aria-pressed={difficulty === opt.value}
                  onClick={() => setDifficulty(opt.value as typeof difficulty)}
                  className={option(difficulty === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced: Round Feedback */}
          {mode === 'advanced' && (
            <div>
              <div className="flex items-center justify-between gap-3 px-4">
                <span className="lab lab-w">Rate Each Round</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="One round fewer"
                    onClick={() => setRounds(Math.max(1, rounds - 1))}
                    className="plate plate-graphite fx h-11 w-11 text-3xl"
                  >
                    -
                  </button>
                  <span className="fx w-9 text-center text-3xl">{rounds}</span>
                  <button
                    type="button"
                    aria-label="One round more"
                    onClick={() => setRounds(rounds + 1)}
                    className="plate plate-graphite fx h-11 w-11 text-3xl"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="mt-1">
                {Array.from({ length: rounds }, (_, i) => i + 1).map((roundNum) => {
                  const feedback = roundFeedback.find((r) => r.roundNumber === roundNum);
                  return (
                    <div key={roundNum} className="grid grid-cols-[2.5rem_1fr] items-center gap-2 border-b border-surface-2 py-1 pl-4 pr-5">
                      <span className="fx text-3xl">R{roundNum}</span>
                      <div className="score-five !gap-3">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            type="button"
                            key={rating}
                            aria-label={`Round ${roundNum}, ${rating} out of 5`}
                            aria-pressed={feedback?.rating === rating}
                            onClick={() => handleRoundRating(roundNum, rating)}
                            className={cn('plate fx h-11 text-2xl', feedback?.rating === rating ? 'plate-lime' : 'plate-graphite')}
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
          <div className="px-4">
            <label htmlFor="log-notes" className="lab mb-2 block">Notes</label>
            <div className="relative">
              <Textarea
                id="log-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did it go? What did you work on?"
                className="h-32 resize-none pr-20"
              />
              {dictation.supported && (
                <button
                  type="button"
                  onClick={dictation.toggle}
                  aria-label={dictation.listening ? 'Stop dictating' : 'Dictate notes'}
                  className={cn('plate absolute bottom-3 right-4 h-11 w-12', dictation.listening ? 'plate-red' : 'plate-steel')}
                >
                  {dictation.listening ? <StopIcon className="size-5" /> : <MicIcon className="size-5" />}
                </button>
              )}
            </div>
            {dictation.listening && (
              <OnAir className="mt-2">Listening...</OnAir>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="sticky bottom-0 bg-background px-5 pb-3 pt-2 safe-bottom">
          <Button onClick={handleSave} size="lg" className="w-full">
            Log Workout
          </Button>
        </div>
      </div>
    </div>
  );
}
