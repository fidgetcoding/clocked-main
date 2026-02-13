import { useEffect, useState } from 'react';
import { Badge, BADGE_CATEGORY_COLORS } from '@/data/badges';
import { Award, Star, Trophy, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';


interface BadgeEarnOverlayProps {
  badge: Badge;
  onComplete: () => void;
}

function BadgeIcon({ shape }: { shape: string }) {
  switch (shape) {
    case 'hexagon': return <Star className="w-10 h-10" />;
    case 'shield': return <Award className="w-10 h-10" />;
    case 'star': return <Star className="w-10 h-10 fill-current" />;
    case 'diamond': return <Trophy className="w-10 h-10" />;
    default: return <Zap className="w-10 h-10" />;
  }
}

export function BadgeEarnOverlay({ badge, onComplete }: BadgeEarnOverlayProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');
  const colors = BADGE_CATEGORY_COLORS[badge.category];

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
        'fixed inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-none',
        phase === 'enter' && 'animate-badge-overlay-in',
        phase === 'exit' && 'animate-badge-overlay-out',
      )}
    >
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-background/80"
        style={{
          opacity: phase === 'exit' ? 0 : 1,
          transition: 'opacity 0.5s ease-out',
        }}
      />

      {/* Badge content */}
      <div
        className={cn(
          'relative flex flex-col items-center gap-3 transition-all duration-500',
          phase === 'enter' && 'scale-50 opacity-0',
          phase === 'hold' && 'scale-100 opacity-100',
          phase === 'exit' && 'scale-75 opacity-0',
        )}
      >
        {/* Glow ring */}
        <div
          className={cn(
            'w-28 h-28 rounded-full flex items-center justify-center',
            colors.bg, colors.text,
            'shadow-[0_0_60px_20px] animate-badge-pulse',
          )}
          style={{
            '--tw-shadow-color': `hsl(var(--electric-volt) / 0.3)`,
          } as React.CSSProperties}
        >
          <div className={cn(
            'w-24 h-24 rounded-full flex items-center justify-center border-2 border-current/30',
            colors.bg,
          )}>
            <BadgeIcon shape={badge.shape} />
          </div>
        </div>

        {/* Badge earned label */}
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Badge Earned
        </span>

        {/* Badge name */}
        <h2 className={cn('text-2xl font-black', colors.text)}>
          {badge.name}
        </h2>

        {/* Description */}
        <p className="text-sm text-muted-foreground max-w-[200px] text-center">
          {badge.description}
        </p>

        {/* XP reward */}
        <span className="text-lg font-black text-volt">
          +{badge.xpReward.toLocaleString()} XP
        </span>
      </div>
    </div>
  );
}

/** Fallback sound if playSoundEffect.badgeEarn doesn't exist */
function playBadgeSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
