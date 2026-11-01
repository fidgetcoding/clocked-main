import { GloveArt } from '@/components/ui/GameArt';
import { useEffect, useState } from 'react';
import { playSoundEffect } from '@/hooks/useSoundEffects';
import { Glove } from '@/data/gloves';
import { FitText } from '@/components/broadcast/FitText';
import { Plate } from '@/components/broadcast/Plate';
import { cn } from '@/lib/utils';

interface GloveUnlockOverlayProps {
  glove: Glove;
  onComplete: () => void;
}

export function GloveUnlockOverlay({ glove, onComplete }: GloveUnlockOverlayProps) {
  const [phase, setPhase] = useState<'flash' | 'reveal' | 'details' | 'out'>('flash');

  useEffect(() => {
    playSoundEffect.levelUp();

    const t1 = setTimeout(() => setPhase('reveal'), 400);
    const t2 = setTimeout(() => setPhase('details'), 1200);
    const t3 = setTimeout(() => setPhase('out'), 3200);
    const t4 = setTimeout(onComplete, 3800);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 z-[100] flex flex-col justify-center overflow-hidden bg-background transition-opacity duration-500',
        phase === 'out' && 'opacity-0',
      )}
    >
      <Plate tone="lime" bleed="left" className="plate-slap h-11 w-fit justify-start pl-4 pr-8 text-3xl">
        New Gloves Unlocked
      </Plate>
      <GloveArt id={glove.id} className="mx-auto my-3 aspect-square w-[min(90vw,50dvh)]" />
      <Plate tone="white" bleed="both" className="h-20 w-full justify-start px-4">
        <FitText className="h-[80%]" max={72}>{glove.name}</FitText>
      </Plate>
      <p className={cn('mx-4 mt-3 text-lg transition-opacity duration-300', phase === 'flash' && 'opacity-0')}>{glove.description}</p>
    </div>
  );
}
