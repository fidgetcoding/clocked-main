import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { plateClass } from '@/components/broadcast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CommunityPost } from '@/hooks/useCommunityPosts';

/** A row of plates, one lit. White is the channel you're on. */
export function PlateTabs<T extends string>({ tabs, value, onChange, size = 'tab', className }: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  size?: 'tab' | 'chip';
  className?: string;
}) {
  return (
    <div className={cn('flex', size === 'tab' ? 'gap-2 min-[360px]:gap-3' : 'gap-3', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            plateClass({ tone: value === tab.id ? 'white' : 'graphite' }),
            'fx h-11 shrink-0',
            size === 'tab' ? 'px-3 text-2xl min-[360px]:px-4' : 'px-3 text-xl',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

const likesLabel = (likes: number) => `${likes} ${likes === 1 ? 'like' : 'likes'}`;

/** Small print listing tags, comma-free so a long tag can wrap on its own. */
export function TagList({ tags }: { tags?: string[] | null }) {
  if (!tags?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
      {tags.map((tag) => (
        <span key={tag} className="lab lab-lime">{tag}</span>
      ))}
    </div>
  );
}

interface FeedPostProps {
  post: CommunityPost;
  isMine: boolean;
  timeAgo: string;
  onDelete: () => void;
  onSave: () => void;
  /** Leave out where the name shouldn't link to a profile. */
  onOpenProfile?: () => void;
}

/** One highlight: a name plate off the left edge, then what they did. */
export function FeedPost({ post, isMine, timeAgo, onDelete, onSave, onOpenProfile }: FeedPostProps) {
  const nameClass = cn(plateClass({ tone: isMine ? 'lime' : 'steel', bleed: 'left' }), 'fx h-11 min-w-0 max-w-[65%] justify-start pl-4 pr-5 text-2xl');
  return (
    <article className="card-workout border-b border-surface-3 bg-transparent p-0 py-2.5">
      <div className="flex min-h-11 items-center gap-3">
        {onOpenProfile ? (
          <button type="button" onClick={onOpenProfile} className={nameClass}>
            <span className="truncate">{post.user_name}</span>
          </button>
        ) : (
          <span className={nameClass}>
            <span className="truncate">{post.user_name}</span>
          </span>
        )}
        <span className="lab min-w-0">{timeAgo}</span>
        {isMine && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete post"
            className="ml-auto mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-3 px-4 pt-1.5">
        {post.user_avatar && <img src={post.user_avatar} alt="" className="art-slant h-12 w-14 shrink-0 object-cover" />}
        <div className="min-w-0 flex-1">
          {post.type === 'workout_complete' && (
            <p className="prose-w break-words text-lg">{post.message || `Completed "${post.workout_name}"`}</p>
          )}
          {post.type === 'preset_shared' && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-48">
                <p className="prose-w text-lg">Shared a workout:</p>
                <p className="fx mt-0.5 break-words text-3xl">{post.custom_name || post.workout_name}</p>
                <TagList tags={post.tags} />
                {post.message && <p className="mt-1 break-words text-base text-muted-foreground">"{post.message}"</p>}
              </div>
              <Button size="sm" onClick={onSave}>Save Workout</Button>
            </div>
          )}
          <p className="lab mt-1.5">{likesLabel(post.likes)}</p>
        </div>
      </div>
    </article>
  );
}

/** One listing: the running time big on the left, the name, and small print under it. */
export function ListingRow({ minutes, title, meta, tags, action, onClick }: {
  minutes: number | null;
  title: ReactNode;
  meta: ReactNode;
  tags?: string[] | null;
  /** Icon on the plate at the end of the row. */
  action: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="listing-row"
      onClick={onClick}
      className="grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-surface-2 px-4 py-2 text-left transition-colors hover:bg-surface-1"
    >
      <span>
        <span className="fx block text-4xl text-volt">{minutes ?? '-'}</span>
        <span className="lab">Min</span>
      </span>
      <span className="min-w-0">
        <span className="fx block break-words text-3xl">{title}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">{meta}</span>
        <TagList tags={tags} />
      </span>
      <span className={cn(plateClass({ tone: 'steel' }), 'h-11 w-12')}>{action}</span>
    </button>
  );
}
