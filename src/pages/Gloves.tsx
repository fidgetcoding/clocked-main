import { AppLayout } from '@/components/layout/AppLayout';
import { BroadcastPage, SectionRule } from '@/components/broadcast';
import { useGloves } from '@/hooks/useGloves';
import { GLOVES, TIER_SECTIONS, getGlovesForTier, Glove } from '@/data/gloves';
import { cn } from '@/lib/utils';
import { GloveArt } from '@/components/ui/GameArt';
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
  const isBMF = glove.id === 'bmf';

  return (
    <button
      type="button"
      disabled={!isUnlocked}
      onClick={onEquip}
      aria-pressed={isEquipped}
      className={cn('min-w-0 text-center', isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed')}
    >
      <span
        className={cn(
          'art-slant block aspect-square w-full [clip-path:polygon(24.9%_0,100%_0,75.1%_100%,0_100%)]',
          isEquipped && '!bg-volt',
        )}
      >
        <GloveArt
          id={glove.id}
          className={cn('h-full w-full', !isUnlocked && 'art-off', isEquipped && 'mix-blend-multiply')}
        />
      </span>
      <span
        className={cn(
          'fx mt-1 line-clamp-2 block text-base leading-none',
          !isUnlocked && 'text-muted-foreground',
          isBMF && isUnlocked && 'text-championship-gold',
        )}
      >
        {glove.name}
      </span>
      <span className={cn('lab mt-0.5 block tracking-[0.04em]', isEquipped && 'lab-lime')}>
        {isEquipped ? 'Equipped' : isUnlocked ? 'Unlocked' : isBMF ? 'Pro L500 + 365d' : `Lvl ${glove.level}`}
      </span>
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
      <BroadcastPage show="Gloves">
        <h1 className="sr-only">Gloves</h1>

        {/* In the corner: what you're wearing */}
        <section className="relative mt-2 h-52 overflow-hidden sm:h-64">
          <div className="absolute inset-y-0 right-0 w-[56%] bg-[#0a0a0a] [clip-path:polygon(3.25rem_0,100%_0,100%_100%,0_100%)] sm:[clip-path:polygon(4rem_0,100%_0,100%_100%,0_100%)]">
            <GloveArt id={equipped.id} className="h-full w-full object-cover" />
          </div>
          <div className="relative flex h-full max-w-[62%] flex-col px-4 pt-3">
            <p className="lab lab-lime">Currently Equipped</p>
            <p className="fx mt-1.5 text-[clamp(2.75rem,14vw,4.5rem)] leading-[0.86]">{equipped.name}</p>
            <p className="fx mt-auto pb-2 text-3xl">
              <span className="text-volt">{totalUnlocked}</span> of 52
            </p>
          </div>
        </section>
        <p className="prose-w border-b border-surface-2 px-4 py-2 text-base">{equipped.description}</p>

        {/* Tier by tier */}
        <div className="pb-4">
          {TIER_SECTIONS.map((section) => {
            const gloves = getGlovesForTier(section.key);
            if (gloves.length === 0) return null;

            return (
              <section key={section.key}>
                <SectionRule title={section.label} right={section.subtitle} className="mb-2 pt-4" />
                <div className={cn('grid gap-x-2 gap-y-3 px-3', section.key === 'bmf' ? 'grid-cols-2' : 'grid-cols-4 sm:grid-cols-5')}>
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
              </section>
            );
          })}
        </div>
      </BroadcastPage>
    </AppLayout>
  );
};

export default Gloves;
