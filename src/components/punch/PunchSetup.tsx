import { BroadcastPage, CameraIcon, SectionRule } from '@/components/broadcast';
import { VoiceToggle } from '@/components/broadcast/VoiceToggle';
import { Button } from '@/components/ui/button';
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
  const { roundSeconds, setRoundSeconds } = usePunchPrefsStore();
  const { hasChosen, setStance } = useStance();

  return (
    <BroadcastPage show="Setup" onBack={onBack} backLabel="Home" className="pb-6">
      <div className="px-4 pt-3">
        <h1 className="fx text-7xl">Punch Check</h1>
        <p className="mt-2 text-lg">
          Hit a bag or shadowbox with your camera propped nearby. It counts your punches and calls out one thing to fix at a time.
        </p>
      </div>

      {!hasChosen && (
        <div className="mt-3 flex items-center justify-between gap-3 border-y border-surface-2 px-4 py-1.5" data-testid="stance-default">
          <p className="text-base">Set to orthodox, left hand leading.</p>
          <button onClick={() => setStance('southpaw')} className="fx h-11 shrink-0 text-2xl text-volt">
            Southpaw?
          </button>
        </div>
      )}

      <div className="mt-3 px-4">
        <p className="lab mb-2">Round</p>
        <div className="flex gap-3" role="radiogroup" aria-label="Round length">
          {ROUNDS.map((option) => (
            <button
              key={option.value}
              role="radio"
              aria-checked={roundSeconds === option.value}
              onClick={() => setRoundSeconds(option.value)}
              className={cn('plate fx h-11 min-w-0 flex-1 px-1 text-xl', roundSeconds === option.value ? 'plate-lime' : 'plate-graphite')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex min-h-11 items-center justify-between gap-3 border-y border-surface-2 px-4 py-2">
        <span className="text-lg">Say the cues out loud</span>
        <VoiceToggle />
      </div>

      <SectionRule title="Set up your camera" />
      <ol>
        {[
          'Prop it in front of you at hip height, 6 to 10 feet back. That names the most punches',
          "Don't put it behind the bag, it can't see you there. Go just far enough around to see past it",
          'On the floor it counts, but adds a few extra and names fewer',
          "From behind you it misses some punches and can't name them",
          'Leave room above your head, and keep your hands and hips in the picture',
          'Put the light in front of you, not behind',
        ].map((tip, index) => (
          <li key={tip} className="flex items-baseline gap-3 border-b border-surface-2 px-4 py-1.5 text-lg">
            <b className="fx w-4 shrink-0 text-2xl text-volt">{index + 1}</b>
            {tip}
          </li>
        ))}
      </ol>

      <p className="mt-3 px-4 text-sm text-muted-foreground">
        This is a form guide from one camera angle. It can't judge your power, and it's no replacement for a coach.
      </p>

      <div className="mt-4 px-5">
        <Button size="lg" onClick={onStart} className="w-full gap-3">
          <CameraIcon className="size-6" />
          Start camera
        </Button>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Your video stays on this device. It isn't recorded or uploaded.{' '}
          <a href="/mediapipe/NOTICE.txt" target="_blank" rel="noreferrer" className="underline">
            Licences
          </a>
        </p>
      </div>
    </BroadcastPage>
  );
}
