import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { playSoundEffect } from '@/hooks/useSoundEffects';
import { 
  Prestige, PRESTIGE_NAMES, PRESTIGE_ORDER, 
  getPrestigeChanges, getNextPrestige 
} from '@/lib/xpSystem';
import { cn } from '@/lib/utils';
import { Crown, ChevronUp, Shield, Swords, Star, ArrowRight } from 'lucide-react';

// Tier-specific colors
const TIER_COLORS: Record<Prestige, { bg: string; text: string; border: string; glow: string }> = {
  rookie:       { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', glow: 'shadow-slate-500/30' },
  beginner:     { bg: 'bg-volt/20', text: 'text-volt', border: 'border-volt/30', glow: 'shadow-volt/30' },
  intermediate: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-blue-500/30' },
  advanced:     { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'shadow-purple-500/30' },
  pro:          { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/30' },
};

const TIER_ICONS: Record<Prestige, React.ReactNode> = {
  rookie:       <Shield className="w-12 h-12" />,
  beginner:     <Swords className="w-12 h-12" />,
  intermediate: <Star className="w-12 h-12" />,
  advanced:     <Crown className="w-12 h-12" />,
  pro:          <Crown className="w-12 h-12" />,
};

interface PrestigePromptProps {
  currentPrestige: Prestige;
  onPrestige: () => void;
  onDefer: () => void;
}

export function PrestigePrompt({ currentPrestige, onPrestige, onDefer }: PrestigePromptProps) {
  const [confirming, setConfirming] = useState(false);
  const changes = getPrestigeChanges(currentPrestige);
  
  useEffect(() => {
    playSoundEffect.prestige();
  }, []);
  
  if (!changes) return null;
  
  const nextColors = TIER_COLORS[changes.nextTier];
  const currentColors = TIER_COLORS[currentPrestige];

  if (confirming) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-background safe-top safe-bottom">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className={cn('w-20 h-20 rounded-2xl mx-auto flex items-center justify-center', nextColors.bg, nextColors.text)}>
            {TIER_ICONS[changes.nextTier]}
          </div>
          
          <div>
            <h2 className="text-2xl font-black text-foreground mb-2">Are you sure?</h2>
            <p className="text-sm text-muted-foreground">
              This promotion is <span className="font-bold text-foreground">permanent</span>. 
              You'll advance to {changes.nextTierName} and start at Level 1 with a harder XP curve.
            </p>
          </div>

          <div className="card-workout text-left space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">What carries over</h4>
            <p className="text-sm text-foreground">✅ All lifetime stats (combos, pushups, hours, etc.)</p>
            <p className="text-sm text-foreground">✅ All earned badges — permanently yours</p>
            <p className="text-sm text-foreground">✅ Your current streak stays unbroken</p>
          </div>

          <div className="card-workout text-left space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">What resets</h4>
            <p className="text-sm text-foreground">🔄 Level resets to 1 in {changes.nextTierName}</p>
            <p className="text-sm text-foreground">🔄 XP progress starts fresh on a harder curve</p>
            <p className="text-sm text-foreground">🔄 Workout combos become more complex</p>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={() => setConfirming(false)} 
              variant="outline" 
              className="flex-1 bg-surface-1 border-surface-3"
            >
              Go Back
            </Button>
            <Button 
              onClick={onPrestige}
              className={cn('flex-1 font-bold text-white', nextColors.bg, 'hover:opacity-90 border', nextColors.border)}
            >
              Prestige Now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-background safe-top safe-bottom">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Celebration */}
        <div className="relative">
          <div className={cn(
            'w-24 h-24 rounded-2xl mx-auto flex items-center justify-center shadow-xl',
            nextColors.bg, nextColors.text, nextColors.glow
          )}>
            <ChevronUp className="w-16 h-16 animate-bounce" />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-black text-foreground mb-2">
            PRESTIGE UNLOCKED
          </h1>
          <p className="text-lg text-muted-foreground">
            You've conquered <span className={cn('font-bold', currentColors.text)}>{changes.currentTierName}</span>.
          </p>
          <p className="text-lg text-muted-foreground">
            You're ready to prestige.
          </p>
        </div>

        {/* Tier Transition */}
        <div className="flex items-center justify-center gap-4">
          <div className={cn('px-4 py-2 rounded-xl font-bold uppercase tracking-wide text-sm', currentColors.bg, currentColors.text, 'border', currentColors.border)}>
            {changes.currentTierName}
          </div>
          <ArrowRight className="w-6 h-6 text-muted-foreground" />
          <div className={cn('px-4 py-2 rounded-xl font-bold uppercase tracking-wide text-sm', nextColors.bg, nextColors.text, 'border', nextColors.border)}>
            {changes.nextTierName}
          </div>
        </div>

        {/* What changes */}
        <div className="card-workout text-left space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">What happens</h3>
          <div className="space-y-2 text-sm">
            <p className="text-foreground">
              <span className={cn('font-bold', nextColors.text)}>New Tier:</span> {changes.nextTierName} — harder combos, more defense moves
            </p>
            <p className="text-foreground">
              <span className={cn('font-bold', nextColors.text)}>Level Reset:</span> Back to Level 1 with a steeper XP curve
            </p>
            <p className="text-foreground">
              <span className={cn('font-bold', nextColors.text)}>Keep Everything:</span> Stats, badges, and streak all carry over
            </p>
          </div>
        </div>

        {/* No pressure message */}
        <div className="px-4 py-3 rounded-xl bg-surface-2/50 border border-surface-3">
          <p className="text-xs text-muted-foreground">
            No rush. You can stay at Champion Level 100 as long as you want — farm badges, build streaks. 
            This button will always be here when you're ready. This is a <span className="font-bold text-foreground">one-way promotion</span>.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button 
            onClick={() => setConfirming(true)}
            className={cn('w-full font-bold text-lg py-6 text-white', nextColors.bg, 'hover:opacity-90 border', nextColors.border)}
          >
            Prestige Now
          </Button>
          <Button 
            onClick={onDefer} 
            variant="outline" 
            className="w-full bg-surface-1 border-surface-3 text-muted-foreground"
          >
            Not Yet
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pro L100 — Max Level celebration (no prestige available)
 */
export function MaxLevelCelebration({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-background safe-top safe-bottom">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-24 h-24 rounded-2xl mx-auto flex items-center justify-center bg-amber-500/20 text-amber-400 shadow-xl shadow-amber-500/30">
          <Crown className="w-16 h-16" />
        </div>

        <div>
          <h1 className="text-3xl font-black text-foreground mb-2">MAX LEVEL</h1>
          <p className="text-lg text-muted-foreground">
            Pro · Champion · Level 100
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            You've reached the pinnacle. Keep training for BMF (250 sessions) and BMFK (365 consecutive days).
          </p>
        </div>

        <Button onClick={onDismiss} className="w-full btn-primary-glow">
          Continue
        </Button>
      </div>
    </div>
  );
}

/**
 * Compact "Prestige Available" banner for Stats/Profile pages.
 */
interface PrestigeBannerProps {
  currentPrestige: Prestige;
  onClick: () => void;
}

export function PrestigeAvailableBanner({ currentPrestige, onClick }: PrestigeBannerProps) {
  const next = getNextPrestige(currentPrestige);
  if (!next) return null;
  
  const nextColors = TIER_COLORS[next];
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between p-4 rounded-2xl border transition-all',
        'hover:scale-[1.01] active:scale-[0.99]',
        nextColors.bg, nextColors.border,
        'shadow-lg', nextColors.glow
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', nextColors.bg, nextColors.text)}>
          <ChevronUp className="w-6 h-6" />
        </div>
        <div className="text-left">
          <p className={cn('text-sm font-bold', nextColors.text)}>Prestige Available</p>
          <p className="text-xs text-muted-foreground">
            Promote to {PRESTIGE_NAMES[next]} when you're ready
          </p>
        </div>
      </div>
      <ArrowRight className={cn('w-5 h-5', nextColors.text)} />
    </button>
  );
}
