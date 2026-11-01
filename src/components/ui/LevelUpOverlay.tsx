import { useEffect } from 'react';
import { FitText, Logo, Plate } from '@/components/broadcast';
import { playSoundEffect } from '@/hooks/useSoundEffects';
import { getRankingFromLevel, RANKING_NAMES } from '@/lib/xpSystem';

type LevelUpVariant = 'volt' | 'cooldown' | 'championship';

interface LevelUpOverlayProps {
  level: number;
  onComplete: () => void;
  variant?: LevelUpVariant;
}

const BACKGROUND: Record<LevelUpVariant, string> = {
  volt: 'bg-volt',
  cooldown: 'bg-foreground',
  championship: 'bg-championship-gold',
};

/** Breaking news: the whole screen for a moment. Never takes a tap. */
export function LevelUpOverlay({ level, onComplete, variant = 'volt' }: LevelUpOverlayProps) {
  useEffect(() => {
    playSoundEffect.levelUp();
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`level-up pointer-events-none fixed inset-0 z-[100] flex flex-col overflow-hidden pt-[max(1rem,env(safe-area-inset-top))] text-background ${BACKGROUND[variant]}`} role="status">
      <Logo className="ml-4 h-4 w-32" />
      <span className="lab ml-4 mt-3 text-background">Breaking</span>
      <FitText className="fx mx-4 h-[18dvh]" max={200}>Level Up</FitText>
      <FitText className="fx mx-4 min-h-0 flex-1" align="center">{String(level)}</FitText>
      <Plate tone="black" bleed="left" className="mb-[8dvh] h-20 w-fit justify-start pl-4 pr-10 text-6xl">
        {RANKING_NAMES[getRankingFromLevel(level)]}
      </Plate>
    </div>
  );
}
