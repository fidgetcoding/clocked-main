import { useEffect, useState } from 'react';
import type { Badge } from '@/data/badges';
import { Plate } from '@/components/broadcast/Plate';
import { BadgeArt } from '@/components/ui/GameArt';
import { cn } from '@/lib/utils';


interface BadgeEarnOverlayProps {
  badge: Badge;
  onComplete: () => void;
}

export function BadgeEarnOverlay({ badge, onComplete }: BadgeEarnOverlayProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    // Play a short celebratory chime
    playBadgeSound();

    const t1 = setTimeout(() => setPhase('hold'), 400);
    const t2 = setTimeout(() => setPhase('exit'), 2200);
    const t3 = setTimeout(onComplete, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 z-[100] flex flex-col justify-center overflow-hidden bg-background/95',
        phase === 'enter' && 'animate-badge-overlay-in',
        phase === 'exit' && 'animate-badge-overlay-out',
      )}
    >
      <Plate tone="lime" bleed="left" className="plate-slap h-12 w-fit justify-start pl-4 pr-8 text-4xl">
        Badge Earned
      </Plate>
      <BadgeArt id={badge.id} className="mx-auto my-4 aspect-square w-[min(70vw,40dvh)]" />
      <h2 className="fx mx-4 text-6xl">{badge.name}</h2>
      <p className="mx-4 mt-2 text-lg">{badge.description}</p>
      <Plate tone="white" bleed="left" className="mt-3 h-16 w-fit justify-start pl-4 pr-9 text-5xl">
        +{badge.xpReward.toLocaleString()} XP
      </Plate>
    </div>
  );
}

/** Fallback sound if playSoundEffect.badgeEarn doesn't exist */
function playBadgeSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    // Quick ascending arpeggio
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.15, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.3);
    });
  } catch {
    // silent fail
  }
}
