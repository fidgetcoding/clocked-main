import { useEffect } from 'react';
import { playSoundEffect } from '@/hooks/useSoundEffects';

type LevelUpVariant = 'volt' | 'cooldown' | 'championship';

interface LevelUpOverlayProps {
  level: number;
  onComplete: () => void;
  variant?: LevelUpVariant;
}

const variantColors: Record<LevelUpVariant, string> = {
  volt: 'hsl(var(--electric-volt))',
  cooldown: 'hsl(var(--cooldown-blue))',
  championship: 'hsl(var(--championship-gold))',
};

export function LevelUpOverlay({ level, onComplete, variant = 'volt' }: LevelUpOverlayProps) {
  useEffect(() => {
    playSoundEffect.levelUp();
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const bg = variantColors[variant];

  return (
    <div 
      className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center overflow-hidden"
      style={{
        animation: 'level-up-flash 2.5s ease-out forwards',
        background: 'transparent',
      }}
    >
      {/* Flash overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: bg,
          animation: 'level-up-flash 2.5s ease-out forwards',
        }}
      />
      
      {/* Level text */}
      <div 
        className="relative flex flex-col items-center gap-2"
        style={{ animation: 'level-up-text 2.5s ease-out forwards' }}
      >
        <span className="text-sm font-bold uppercase tracking-[0.3em] text-white/80">
          Level Up
        </span>
        <span 
          className="text-8xl font-black text-white"
          style={{
            textShadow: '0 0 40px hsl(var(--tech-black) / 0.5), 0 0 80px hsl(var(--tech-black) / 0.3)',
          }}
        >
          {level}
        </span>
      </div>
    </div>
  );
}
