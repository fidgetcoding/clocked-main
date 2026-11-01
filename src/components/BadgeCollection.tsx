import { BadgeArt } from '@/components/ui/GameArt';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useBadges } from '@/hooks/useBadges';
import { Badge, BadgeCategory, BADGE_CATEGORY_NAMES, BadgeStats } from '@/data/badges';
import { PostL100Badge, PostL100Category, POST_L100_CATEGORY_NAMES } from '@/data/postL100Badges';
import { SegmentBar } from '@/components/broadcast';
import { Button } from '@/components/ui/button';

type AnyBadgeCategory = BadgeCategory | PostL100Category;
type AnyBadge = (Badge | PostL100Badge) & { earned: boolean; earnedAt?: string; progress: number };

function getCategoryName(cat: AnyBadgeCategory) {
  if (cat in BADGE_CATEGORY_NAMES) return BADGE_CATEGORY_NAMES[cat as BadgeCategory];
  return POST_L100_CATEGORY_NAMES[cat as PostL100Category];
}

interface BadgeDetailModalProps {
  badge: AnyBadge;
  stats: BadgeStats;
  onClose: () => void;
}

function BadgeDetailModal({ badge, onClose }: BadgeDetailModalProps) {
  const progressPct = Math.round(badge.progress * 100);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={badge.name}>
      <div className="absolute inset-0 bg-background/80" onClick={onClose} />
      <div className="dialog-band overflow-x-hidden">
        <h3 className="dialog-title fx">{badge.name}</h3>
        <div className="mt-3 flex items-start gap-3">
          <BadgeArt id={badge.id} className={cn('size-24 shrink-0 mix-blend-screen', !badge.earned && 'art-off')} />
          <div className="min-w-0 flex-1">
            <p className="lab lab-lime">{getCategoryName(badge.category as AnyBadgeCategory)}</p>
            <p className="prose-w mt-1 text-lg">{badge.description}</p>
            <p className="fx mt-1.5 text-3xl text-volt">+{badge.xpReward.toLocaleString()} XP</p>
          </div>
        </div>

        {badge.earned ? (
          <p className="lab lab-w mt-3">Earned {badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString() : ''}</p>
        ) : (
          <div className="mt-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="lab">Progress</span>
              <span className="fx text-2xl">{progressPct}%</span>
            </div>
            <SegmentBar total={24} filled={Math.round((progressPct / 100) * 24)} height="0.75rem" label={`${progressPct}% of the way there`} />
          </div>
        )}

        <Button variant="secondary" onClick={onClose} className="mt-4 w-full">Close</Button>
      </div>
    </div>
  );
}

export function BadgeCollection() {
  const { getBadgesByCategory, earnedCount, totalBadgeCount, currentStats } = useBadges();
  const [selectedBadge, setSelectedBadge] = useState<AnyBadge | null>(null);
  const [activeCategory, setActiveCategory] = useState<AnyBadgeCategory | 'all'>('all');

  const categories = getBadgesByCategory();
  const filteredCategories = activeCategory === 'all'
    ? categories
    : categories.filter(c => c.category === activeCategory);

  return (
    <section>
      {/* Stat alert: the count, big */}
      <div className="px-4">
        <p className="lab lab-lime">Badges</p>
        <p className="fx mt-1 whitespace-nowrap text-7xl">
          {earnedCount} <span className="text-4xl text-muted-foreground">of {totalBadgeCount}</span>
        </p>
        <SegmentBar
          className="mt-2"
          total={40}
          filled={totalBadgeCount ? Math.round((earnedCount / totalBadgeCount) * 40) : 0}
          height="0.625rem"
          label={`${earnedCount} of ${totalBadgeCount} badges earned`}
        />
      </div>

      {/* Category filter */}
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5 py-0.5">
        {[{ category: 'all' as const, label: 'All' }, ...categories.map(({ category, badges }) => ({
          category,
          label: `${getCategoryName(category)} (${badges.filter(b => b.earned).length})`,
        }))].map(({ category, label }) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            aria-pressed={activeCategory === category}
            className={cn('plate fx h-11 shrink-0 px-4 text-xl', activeCategory === category ? 'plate-white' : 'plate-graphite')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Badge grid */}
      {filteredCategories.map(({ category, badges }) => (
        <div key={category} className="mt-4 px-3">
          {activeCategory === 'all' && (
            <h4 className="fx mb-2 px-1 text-3xl">{getCategoryName(category)}</h4>
          )}
          <div className="grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-6">
            {badges.map((badge) => (
              <button
                key={badge.id}
                type="button"
                onClick={() => setSelectedBadge(badge)}
                className="min-w-0 text-center transition-colors hover:bg-surface-1"
              >
                <BadgeArt id={badge.id} className={cn('aspect-square w-full mix-blend-screen', !badge.earned && 'art-off')} />
                <span className={cn('fx mt-0.5 line-clamp-2 block text-base leading-none', !badge.earned && 'text-muted-foreground')}>
                  {badge.name}
                </span>
                <span className={cn('lab mt-0.5 block tracking-[0.04em]', badge.earned && 'lab-lime')}>
                  {badge.earned ? `+${badge.xpReward} XP` : `${Math.round(badge.progress * 100)}%`}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge}
          stats={currentStats}
          onClose={() => setSelectedBadge(null)}
        />
      )}
    </section>
  );
}
