import { ArrowLeft, Camera, Home, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { usePunchPrefsStore } from '@/stores/punchPrefsStore';
import { useStance } from '@/hooks/useStance';

const ROUNDS = [
  { value: 0, label: 'No timer' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 180, label: '3 min' },
];

interface PunchSetupProps {
  onStart: () => void;
  onBack: () => void;
}

export function PunchSetup({ onStart, onBack }: PunchSetupProps) {
  const { roundSeconds, voiceCues, setRoundSeconds, setVoiceCues } = usePunchPrefsStore();
  const { hasChosen, setStance } = useStance();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-start justify-between px-4 py-3 safe-top">
        <button
          onClick={onBack}
          aria-label="Back to home"
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface-1 border border-surface-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <Home className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 w-full max-w-md mx-auto px-4 pb-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-foreground uppercase tracking-wider">Punch Check</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Shadowbox in front of your camera. It counts your punches and calls out one thing to fix at a time.
          </p>
        </div>

        {!hasChosen && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-1 border border-surface-3" data-testid="stance-default">
            <p className="text-sm text-foreground">Set to orthodox, left hand leading.</p>
            <button onClick={() => setStance('southpaw')} className="shrink-0 text-sm font-bold text-volt">
              Southpaw?
            </button>
          </div>
        )}

        <div>
          <p className="text-sm text-muted-foreground mb-2">Round</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Round length">
            {ROUNDS.map((option) => (
              <button
                key={option.value}
                role="radio"
                aria-checked={roundSeconds === option.value}
                onClick={() => setRoundSeconds(option.value)}
                className={cn(
                  'flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors',
                  roundSeconds === option.value
                    ? 'bg-volt text-primary-foreground'
                    : 'bg-surface-1 border border-surface-3 text-muted-foreground hover:bg-surface-2',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-1 border border-surface-3">
          <span className="text-sm text-foreground">Say the cues out loud</span>
          <Switch checked={voiceCues} onCheckedChange={setVoiceCues} aria-label="Say the cues out loud" />
        </label>

        <div className="card-workout space-y-2">
          <p className="text-sm font-bold text-foreground">Set up your camera</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            <li>Put it anywhere, but about 30° to one side reads best. Dead straight on hides your jab and cross, and fully side on hides your far arm</li>
            <li>Stand 6 to 8 feet back, or further if it's on a desk</li>
            <li>Leave room above your head, and keep your hands and hips in the picture</li>
            <li>Put the light in front of you, not behind</li>
          </ul>
        </div>

        <p className="text-sm text-muted-foreground">
          This is a form guide from one camera angle. It can't judge your power, and it's no replacement for a coach.
        </p>

        <div className="space-y-3">
          <Button onClick={onStart} className="btn-primary-glow w-full">
            <Camera />
            Start camera
          </Button>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-volt" />
            <span>
              Your video stays on this device. It isn't recorded or uploaded.{' '}
              <a href="/mediapipe/NOTICE.txt" target="_blank" rel="noreferrer" className="underline">
                Licences
              </a>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
