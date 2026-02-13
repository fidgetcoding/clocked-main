import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useBadges } from '@/hooks/useBadges';
import { Badge, BadgeCategory, BADGE_CATEGORY_COLORS, BADGE_CATEGORY_NAMES, BadgeStats } from '@/data/badges';
import { PostL100Badge, PostL100Category, POST_L100_CATEGORY_COLORS, POST_L100_CATEGORY_NAMES } from '@/data/postL100Badges';
import { Progress } from '@/components/ui/progress';
import { X } from 'lucide-react';

type AnyBadgeCategory = BadgeCategory | PostL100Category;
type AnyBadge = (Badge | PostL100Badge) & { earned: boolean; earnedAt?: string; progress: number };

function getCategoryColors(cat: AnyBadgeCategory) {
  if (cat in BADGE_CATEGORY_COLORS) return BADGE_CATEGORY_COLORS[cat as BadgeCategory];
  return POST_L100_CATEGORY_COLORS[cat as PostL100Category];
}

function getCategoryName(cat: AnyBadgeCategory) {
  if (cat in BADGE_CATEGORY_NAMES) return BADGE_CATEGORY_NAMES[cat as BadgeCategory];
  return POST_L100_CATEGORY_NAMES[cat as PostL100Category];
}

// Badge shape components
function BadgeShapeIcon({ shape, earned, categoryColor }: { shape: string; earned: boolean; categoryColor: string }) {
  const size = 'w-12 h-12';
  const baseClasses = cn(
    size, 'flex items-center justify-center transition-all duration-300',
    earned ? `${categoryColor} shadow-lg` : 'bg-surface-2 opacity-40'
  );

  switch (shape) {
    case 'hexagon':
      return <div className={cn(baseClasses, 'clip-hexagon')} />;
    case 'shield':
      return <div className={cn(baseClasses, 'rounded-t-full rounded-b-lg')} />;
    case 'star':
      return <div className={cn(baseClasses, 'rotate-45 rounded-lg')} />;
    case 'diamond':
      return <div className={cn(baseClasses, 'rotate-45 rounded-md scale-90')} />;
    default: // circle
      return <div className={cn(baseClasses, 'rounded-full')} />;
  }
}

interface BadgeDetailModalProps {
  badge: AnyBadge;
  stats: BadgeStats;
  onClose: () => void;
}

function BadgeDetailModal({ badge, stats, onClose }: BadgeDetailModalProps) {
  const colors = getCategoryColors(badge.category as AnyBadgeCategory);
  const progressPct = Math.round(badge.progress * 100);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 bg-surface-1 rounded-2xl border border-surface-3 p-6 animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="text-center mb-4">
          <div className={cn('w-20 h-20 mx-auto mb-3 rounded-full flex items-center justify-center', badge.earned ? colors.bg : 'bg-surface-2')}>
            <BadgeShapeIcon shape={badge.shape} earned={badge.earned} categoryColor={colors.bg} />
          </div>
          <h3 className={cn('text-lg font-bold', badge.earned ? colors.text : 'text-muted-foreground')}>
            {badge.name}
          </h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
            {getCategoryName(badge.category as AnyBadgeCategory)}
          </p>
        </div>

        <p className="text-sm text-foreground text-center mb-3">{badge.description}</p>
        <p className="text-sm text-volt text-center font-semibold mb-4">+{badge.xpReward.toLocaleString()} XP</p>

        {badge.earned ? (
          <div className="text-center">
            <span className="text-xs text-muted-foreground">
              Earned {badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString() : ''}
            </span>
          </div>
        ) : (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        )}
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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
          Badges
        </h3>
        <span className="text-xs text-muted-foreground">
          {earnedCount} / {totalBadgeCount}
        </span>
      </div>

      {/* Category Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 no-scrollbar">
        <button
          onClick={() => setActiveCategory('all')}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
            activeCategory === 'all' ? 'bg-volt text-primary-foreground' : 'bg-surface-2 text-muted-foreground'
          )}
        >
          All
        </button>
        {categories.map(({ category }) => {
          const colors = getCategoryColors(category);
          const count = categories.find(c => c.category === category)?.badges.filter(b => b.earned).length || 0;
          return (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                activeCategory === category ? `${colors.bg} ${colors.text}` : 'bg-surface-2 text-muted-foreground'
              )}
            >
              {getCategoryName(category)} ({count})
            </button>
          );
        })}
      </div>

      {/* Badge Grid */}
      {filteredCategories.map(({ category, badges }) => (
        <div key={category} className="mb-6">
          {activeCategory === 'all' && (
            <h4 className={cn('text-xs font-semibold uppercase tracking-wider mb-2', getCategoryColors(category).text)}>
              {getCategoryName(category)}
            </h4>
          )}
          <div className="grid grid-cols-5 gap-2">
            {badges.map((badge) => {
              const colors = getCategoryColors(badge.category as AnyBadgeCategory);
              return (
                <button
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                    badge.earned 
                      ? `${colors.bg} ring-2 ring-offset-1 ring-offset-background ${colors.glow.replace('shadow-', 'ring-')}` 
                      : 'bg-surface-2 opacity-30'
                  )}>
                    <BadgeShapeIcon shape={badge.shape} earned={badge.earned} categoryColor={colors.bg} />
                  </div>
                  <span className={cn(
                    'text-[9px] leading-tight text-center line-clamp-2',
                    badge.earned ? 'text-foreground' : 'text-muted-foreground/50'
                  )}>
                    {badge.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge}
          stats={currentStats}
          onClose={() => setSelectedBadge(null)}
        />
      )}
    </div>
  );
}
