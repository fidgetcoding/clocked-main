import { useState } from 'react';
import { Trash2, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-surface-1 rounded-2xl border border-surface-3 max-h-[70vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3">
          <h2 className="text-sm font-semibold text-foreground">Shared Workouts</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center hover:bg-surface-3 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Public / Private Toggle */}
        <div className="px-4 py-3">
          <div className="flex gap-2 p-1 bg-surface-2 rounded-lg">
            <button
              onClick={() => setFilter('public')}
              className={cn(
                'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all',
                filter === 'public'
                  ? 'bg-volt text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Public ({publicWorkouts.length})
            </button>
            <button
              onClick={() => setFilter('private')}
              className={cn(
                'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all',
                filter === 'private'
                  ? 'bg-volt text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Private ({privateWorkouts.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : displayed.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No {filter} shared workouts yet.
            </p>
          ) : (
            <div className="space-y-2">
              {displayed.map((post) => (
                <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 border border-surface-3">
                  <div className="w-10 h-10 rounded-xl bg-volt/20 flex items-center justify-center text-xl flex-shrink-0">
                    {(post.workout_data)?.icon || '🥊'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {post.custom_name || post.workout_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(post.created_at || '')}
                      {filter === 'private' && post.club_name && (
                        <span> · {post.club_name}</span>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      deletePost.mutate(post.id, {
                        onSuccess: () => toast.success('Workout unshared'),
                      });
                    }}
                    disabled={deletePost.isPending}
                    className="text-destructive border-surface-3 hover:border-destructive hover:bg-destructive/10 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
