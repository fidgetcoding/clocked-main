import { useEffect } from 'react';

interface LevelUpOverlayProps {
  level: number;
  onComplete: () => void;
}

export function LevelUpOverlay({ level, onComplete }: LevelUpOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
      {/* Volt flash overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'hsl(var(--electric-volt))',
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
