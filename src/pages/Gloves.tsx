import { Lock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useGloves } from '@/hooks/useGloves';
import { GLOVES, TIER_SECTIONS, getGlovesForTier, Glove } from '@/data/gloves';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function GloveCard({
  glove,
  isUnlocked,
  isEquipped,
  onEquip,
}: {
  glove: Glove;
  isUnlocked: boolean;
  isEquipped: boolean;
  onEquip: () => void;
}) {
  const isPrestigeReward = glove.level === 100 || glove.id === 'bmf';
  const isBMF = glove.id === 'bmf';

  return (
    <button
      disabled={!isUnlocked}
      onClick={onEquip}
      className={cn(
        'relative flex flex-col items-center rounded-xl p-2 transition-all border',
        isEquipped
          ? 'border-volt bg-volt/10 ring-1 ring-volt shadow-[0_0_12px_hsl(var(--volt)/0.3)]'
          : isUnlocked
            ? 'border-surface-3 bg-surface-1 hover:bg-surface-2 cursor-pointer'
            : 'border-surface-3/50 bg-surface-1/30 cursor-not-allowed opacity-60',
        isPrestigeReward && isUnlocked && 'col-span-1'
      )}
    >
      {/* Glove placeholder */}
      <div
        className={cn(
          'w-full aspect-square rounded-lg flex items-center justify-center mb-1.5 transition-all',
          isPrestigeReward && 'ring-1 ring-white/20',
          isBMF && isUnlocked && 'ring-2 ring-[#FFD700]'
        )}
        style={{
          backgroundColor: isUnlocked
            ? glove.tierThemeColor
            : `${glove.tierThemeColor}33`,
          ...(isBMF && { border: '2px solid #1A1A1A' }),
        }}
      >
        {!isUnlocked && <Lock className="w-5 h-5 text-muted-foreground/60" />}
      </div>

      {/* Name */}
      <p className={cn(
        'text-[10px] font-medium text-center leading-tight line-clamp-2',
        isUnlocked ? 'text-foreground' : 'text-muted-foreground/60'
      )}>
        {glove.name}
      </p>

      {/* Equipped badge */}
      {isEquipped && (
        <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-volt text-primary-foreground px-1.5 py-0.5 rounded-full">
          EQUIPPED
        </span>
      )}

      {/* Unlock requirement for locked gloves */}
      {!isUnlocked && (
        <p className="text-[8px] text-muted-foreground/40 mt-0.5">
          {isBMF ? 'Pro L500 + 365d' : `L${glove.level}`}
        </p>
      )}
    </button>
  );
}

const Gloves = () => {
  const { equippedGlove, unlockedGloves, equipGlove } = useGloves();
  const totalUnlocked = unlockedGloves.length;
  const equipped = GLOVES[equippedGlove] || GLOVES.default;

  const handleEquip = (gloveId: string) => {
    if (gloveId === equippedGlove) return;
    equipGlove.mutate(gloveId, {
      onSuccess: () => toast.success(`Equipped: ${GLOVES[gloveId]?.name}`),
    });
  };

  return (
    <AppLayout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 safe-top border-b border-surface-3">
          <h1 className="text-xl font-bold text-foreground">Gloves</h1>
          <span className="text-sm text-muted-foreground">{totalUnlocked}/52</span>
        </header>

        {/* Currently Equipped */}
        <div className="px-4 py-4 border-b border-surface-3">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Currently Equipped</p>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl ring-2 ring-volt"
              style={{ backgroundColor: equipped.tierThemeColor }}
            />
            <div>
              <p className="text-sm font-bold text-foreground">{equipped.name}</p>
              <p className="text-xs text-muted-foreground">{equipped.description}</p>
            </div>
          </div>
        </div>

        {/* Tier Sections */}
        <div className="px-4 py-4 space-y-6">
          {TIER_SECTIONS.map((section) => {
            const gloves = getGlovesForTier(section.key);
            if (gloves.length === 0) return null;

            return (
              <div key={section.key}>
                <div className="flex items-baseline gap-2 mb-3">
                  <h2 className="text-sm font-bold text-foreground tracking-wider">{section.label}</h2>
                  <span className="text-[10px] text-muted-foreground">{section.subtitle}</span>
                </div>
                <div className={cn(
                  'grid gap-2',
                  section.key === 'bmf' ? 'grid-cols-2' : 'grid-cols-5'
                )}>
                  {gloves.map((glove) => (
                    <GloveCard
                      key={glove.id}
                      glove={glove}
                      isUnlocked={unlockedGloves.includes(glove.id)}
                      isEquipped={equippedGlove === glove.id}
                      onEquip={() => handleEquip(glove.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Gloves;
