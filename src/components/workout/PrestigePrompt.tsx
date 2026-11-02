import { useState, useEffect } from 'react';
import { BroadcastPage, Plate, SectionRule } from '@/components/broadcast';
import { GloveArt } from '@/components/ui/GameArt';
import { Button } from '@/components/ui/button';
import { playSoundEffect } from '@/hooks/useSoundEffects';
import { Prestige, PRESTIGE_NAMES, getPrestigeChanges, getNextPrestige } from '@/lib/xpSystem';

// The gloves that close out each tier
const TIER_GLOVE: Record<Prestige, string> = {
  rookie: 'golden',
  beginner: 'platinum',
  intermediate: 'emerald',
  advanced: 'ruby',
  pro: 'bmf',
};

interface PrestigePromptProps {
  currentPrestige: Prestige;
  onPrestige: () => void;
  onDefer: () => void;
}

const Line = ({ tone, children }: { tone: 'keep' | 'reset'; children: React.ReactNode }) => (
  <p className="flex items-baseline gap-3 border-b border-surface-2 px-4 py-2 text-lg">
    <i className={`block h-2.5 w-4 shrink-0 -skew-x-[14deg] ${tone === 'keep' ? 'bg-volt' : 'bg-foreground'}`} />
    {children}
  </p>
);

export function PrestigePrompt({ currentPrestige, onPrestige, onDefer }: PrestigePromptProps) {
  const [confirming, setConfirming] = useState(false);
  const changes = getPrestigeChanges(currentPrestige);

  useEffect(() => {
    playSoundEffect.prestige();
  }, []);

  if (!changes) return null;

  if (confirming) {
    return (
      <BroadcastPage show="Rank up" className="pb-6">
        <Plate as="h2" tone="white" bleed="both" className="mt-3 flex h-20 justify-start px-4 text-6xl">
          Are you sure?
        </Plate>
        <p className="mt-3 px-4 text-lg">
          This promotion is <b>permanent</b>. You'll advance to {changes.nextTierName} and start at Level 1 with a harder XP curve.
        </p>
        <SectionRule title="What carries over" className="mt-2" />
        <Line tone="keep">All lifetime stats (combos, pushups, hours, etc.)</Line>
        <Line tone="keep">All earned badges, permanently yours</Line>
        <Line tone="keep">Your current streak stays unbroken</Line>
        <SectionRule title="What resets" className="mt-2" />
        <Line tone="reset">Level resets to 1 in {changes.nextTierName}</Line>
        <Line tone="reset">XP progress starts fresh on a harder curve</Line>
        <Line tone="reset">Workout combos become more complex</Line>
        <div className="mt-5 flex gap-4 px-5">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>Go Back</Button>
          <Button className="flex-1" onClick={onPrestige}>Prestige Now</Button>
        </div>
      </BroadcastPage>
    );
  }

  return (
    <BroadcastPage show="Rank up" className="pb-6">
      <div className="relative mt-2 flex min-h-[13rem] items-start overflow-hidden">
        <div className="relative z-10 px-4 pt-2">
          <p className="lab lab-lime">You've conquered</p>
          <p className="fx text-7xl">{changes.currentTierName}</p>
          <p className="fx mt-2 text-2xl">You're ready to prestige.</p>
        </div>
        <GloveArt id={TIER_GLOVE[currentPrestige]} className="art-slant absolute -right-4 top-0 h-52 w-52" />
      </div>
      <Plate as="h1" tone="lime" bleed="both" className="flex h-20 justify-start px-4 text-6xl">
        PRESTIGE UNLOCKED
      </Plate>
      <SectionRule title="What happens" className="mt-3" right={`${changes.currentTierName} to ${changes.nextTierName}`} />
      <Line tone="keep">New Tier: {changes.nextTierName}, harder combos, more defense moves</Line>
      <Line tone="reset">Level Reset: back to Level 1 with a steeper XP curve</Line>
      <Line tone="keep">Keep Everything: stats, badges and streak all carry over</Line>
      <p className="mt-3 px-4 text-base text-muted-foreground">
        No rush. You can stay at Champion Level 100 as long as you want and farm badges. This will always be here when you're ready. It's a one-way promotion.
      </p>
      <div className="mt-5 flex gap-4 px-5">
        <Button variant="secondary" className="flex-1" onClick={onDefer}>Not Yet</Button>
        <Button className="flex-1" onClick={() => setConfirming(true)}>Prestige Now</Button>
      </div>
    </BroadcastPage>
  );
}

/**
 * Pro L100: the end of the ladder, with no prestige after it.
 */
export function MaxLevelCelebration({ onDismiss }: { onDismiss: () => void }) {
  return (
    <BroadcastPage show="Done" className="pb-6">
      <Plate as="h1" tone="gold" bleed="both" className="mt-6 flex h-24 justify-start px-4 text-7xl">
        MAX LEVEL
      </Plate>
      <p className="fx mt-4 px-4 text-3xl">Pro, Champion, Level 100</p>
      <p className="mt-2 px-4 text-lg">You've reached the top. Keep training for BMF (250 sessions) and BMFK (365 consecutive days).</p>
      <div className="mt-5 px-5">
        <Button className="w-full" onClick={onDismiss}>Continue</Button>
      </div>
    </BroadcastPage>
  );
}

interface PrestigeBannerProps {
  currentPrestige: Prestige;
  onClick: () => void;
}

/** Compact "Prestige Available" row for Stats and Profile. */
export function PrestigeAvailableBanner({ currentPrestige, onClick }: PrestigeBannerProps) {
  const next = getNextPrestige(currentPrestige);
  if (!next) return null;
  return (
    <button type="button" onClick={onClick} className="plate plate-lime plate-bleed-l plate-bleed-r flex min-h-16 w-full justify-between px-4 py-2 text-left">
      <span>
        <span className="fx block text-3xl">Prestige Available</span>
        <span className="block text-sm font-semibold">Promote to {PRESTIGE_NAMES[next]} when you're ready</span>
      </span>
    </button>
  );
}
