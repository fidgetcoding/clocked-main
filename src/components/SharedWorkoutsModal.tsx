import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMySharedWorkouts, useDeleteCommunityPost } from '@/hooks/useCommunityPosts';
import { toast } from 'sonner';

interface SharedWorkoutsModalProps {
  onClose: () => void;
}

export const SharedWorkoutsModal = ({ onClose }: SharedWorkoutsModalProps) => {
  const [filter, setFilter] = useState<'public' | 'private'>('public');
  const { data: sharedWorkouts = [], isLoading } = useMySharedWorkouts();
  const deletePost = useDeleteCommunityPost();

  const publicWorkouts = sharedWorkouts.filter(p => p.destination === 'feed' || !p.destination);
  const privateWorkouts = sharedWorkouts.filter(p => p.destination === 'club');

  const displayed = filter === 'public' ? publicWorkouts : privateWorkouts;

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const option = (on: boolean) => cn('plate fx h-11 text-2xl', on ? 'plate-white' : 'plate-graphite');

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-background/85" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="shared-title" className="dialog-panel z-[60] overflow-x-clip !p-0">
        {/* Header */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 pt-3">
          <h2 id="shared-title" className="fx py-1 text-[clamp(2.75rem,14vw,3.75rem)]">Shared Workouts</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="plate plate-graphite h-11 w-12 shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Public / Private Toggle */}
        <div className="grid grid-cols-2 gap-4 px-5 py-3">
          <button type="button" aria-pressed={filter === 'public'} onClick={() => setFilter('public')} className={option(filter === 'public')}>
            Public ({publicWorkouts.length})
          </button>
          <button type="button" aria-pressed={filter === 'private'} onClick={() => setFilter('private')} className={option(filter === 'private')}>
            Private ({privateWorkouts.length})
          </button>
        </div>

        {/* Content */}
        <div className="border-t border-surface-3 pb-4">
          {isLoading ? (
            <p className="lab px-4 py-8">Loading...</p>
          ) : displayed.length === 0 ? (
            <p className="prose-w px-4 py-8 text-lg">
              No {filter} shared workouts yet.
            </p>
          ) : (
            <div>
              {displayed.map((post) => (
                <div key={post.id} className="flex items-center gap-3 border-b border-surface-2 py-2 pl-4 pr-2">
                  <div className="min-w-0 flex-1">
                    <p className="fx break-words text-4xl">
                      {post.custom_name || post.workout_name}
                    </p>
                    <p className="lab mt-1">
                      {formatTimeAgo(post.created_at || '')}
                      {filter === 'private' && post.club_name && (
                        <span>, {post.club_name}</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Unshare ${post.custom_name || post.workout_name}`}
                    onClick={() => {
                      deletePost.mutate(post.id, {
                        onSuccess: () => toast.success('Workout unshared'),
                      });
                    }}
                    disabled={deletePost.isPending}
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
