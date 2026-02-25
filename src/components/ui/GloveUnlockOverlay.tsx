import { useEffect, useState } from 'react';
import { playSoundEffect } from '@/hooks/useSoundEffects';
import { Glove } from '@/data/gloves';

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

  const color = glove.tierThemeColor;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-none">
      {/* Safe-area strips */}
      <div className="absolute top-0 left-0 right-0 z-10" style={{ height: 'max(env(safe-area-inset-top, 0px), 50px)', background: '#0A0A0B' }} />
      <div className="absolute bottom-0 left-0 right-0 z-10" style={{ height: 'max(env(safe-area-inset-bottom, 0px), 50px)', background: '#0A0A0B' }} />

      {/* Dimmed backdrop — matches badge earn */}
      <div
        className="absolute inset-0 bg-background/95"
        style={{
          opacity: phase === 'out' ? 0 : 1,
          transition: 'opacity 0.5s ease-out',
        }}
      />

      {/* Radial ring pulse */}
      <div
        className="absolute rounded-full z-15"
        style={{
          width: phase === 'flash' ? '0px' : '600px',
          height: phase === 'flash' ? '0px' : '600px',
          border: `3px solid ${color}`,
          opacity: phase === 'reveal' || phase === 'details' ? 0.3 : 0,
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: `0 0 60px ${color}30, inset 0 0 60px ${color}10`,
        }}
      />

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center gap-4">
        {/* Glove icon / swatch */}
        <div
          className="rounded-2xl flex items-center justify-center transition-all duration-700"
          style={{
            width: phase === 'flash' ? '20px' : '120px',
            height: phase === 'flash' ? '20px' : '120px',
            background: `linear-gradient(135deg, ${color}, ${color}99)`,
            boxShadow: phase !== 'flash' ? `0 0 50px ${color}60, 0 0 100px ${color}30` : 'none',
            opacity: phase === 'out' ? 0 : 1,
            transform: phase === 'out' ? 'scale(0.8)' : 'scale(1)',
          }}
        >
          <span
            className="transition-all duration-500"
            style={{
              fontSize: phase === 'flash' ? '0px' : '56px',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
            }}
          >
            🥊
          </span>
        </div>

        {/* NEW GLOVES label */}
        <span
          className="text-xs font-bold uppercase tracking-[0.4em] transition-all duration-500"
          style={{
            color: color,
            opacity: phase === 'details' ? 1 : 0,
            transform: phase === 'details' ? 'translateY(0)' : 'translateY(10px)',
          }}
        >
          New Gloves Unlocked
        </span>

        {/* Glove name */}
        <span
          className="text-4xl font-black text-white transition-all duration-500"
          style={{
            opacity: phase === 'reveal' || phase === 'details' ? 1 : 0,
            transform: phase === 'reveal' || phase === 'details' ? 'scale(1) translateY(0)' : 'scale(1.3) translateY(10px)',
            textShadow: `0 0 30px ${color}80, 0 4px 20px rgba(0,0,0,0.5)`,
          }}
        >
          {glove.name}
        </span>

        {/* Description */}
        <p
          className="text-sm text-white/70 max-w-[260px] text-center transition-all duration-500"
          style={{
            opacity: phase === 'details' ? 1 : 0,
            transform: phase === 'details' ? 'translateY(0)' : 'translateY(10px)',
          }}
        >
          {glove.description}
        </p>
      </div>
    </div>
  );
}
