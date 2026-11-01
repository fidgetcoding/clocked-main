import type { StoredPhase } from '@/lib/storedPhases';
import type { WorkoutSection } from '@/types';
import { joinStoredPhases, splitStoredPhases } from '@/lib/storedPhases';
import { useState } from 'react';
import { Search, ChevronRight, Download, X, UserPlus, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { BroadcastPage, EmptyPlate, FitText, Plate, SectionChyron, SegmentBar } from '@/components/broadcast';
import { FeedPost, ListingRow, PlateTabs } from '@/components/fight-club/parts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { WORKOUT_CATEGORIES, TrendingWorkout, WorkoutCategory } from '@/data/trendingWorkouts';
import { WorkoutPreviewModal } from '@/components/WorkoutPreviewModal';
import { LiveStreamPreview } from '@/components/LiveStreamPreview';
import { useWorkouts } from '@/hooks/useWorkouts';
import { useCommunityPosts, CommunityPost, useDeleteCommunityPost } from '@/hooks/useCommunityPosts';

import { toast } from 'sonner';
import { useUserSearch } from '@/hooks/useUserSearch';
import { useFollows } from '@/hooks/useFollows';
import { useClubRanks, useClubs } from '@/hooks/useClubs';
import { memberLabel, splitClubs } from '@/lib/clubs';
import { formatRating } from '@/lib/ratings';
import { useRatingSummaries } from '@/hooks/useWorkoutRating';
import { useAuth } from '@/contexts/useAuth';
import { promptEmailLink } from '@/lib/guest';
import { isBackendConfigured } from '@/integrations/supabase/client';
import { useTierPresets, TierPresetWithLoadout } from '@/hooks/useTierPresets';

type Tab = 'feed' | 'clubs' | 'presets';
type ClubTab = 'feed' | 'chat' | 'leaderboard';

interface SharedWorkoutData {
  description?: string;
  totalDuration?: number;
  duration?: number;
  difficulty?: string;
  phases?: StoredPhase[];
  sections?: Partial<WorkoutSection>;
  combos?: string[][];
}

const FightClub = () => {
  const navigate = useNavigate();
  const { addWorkout } = useWorkouts();
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all');
  const { data: communityPosts, isLoading: postsLoading } = useCommunityPosts(feedFilter, 'feed');
  const deletePost = useDeleteCommunityPost();
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [clubTab, setClubTab] = useState<ClubTab>('feed');
  // Presets tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory>('All');
  const [selectedWorkout, setSelectedWorkout] = useState<TrendingWorkout | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // User search state
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const { results: searchResults, isLoading: searchLoading, hasQuery } = useUserSearch(userSearchQuery);
  const { follow } = useFollows();
  
  // Clubs
  const { user, isGuest } = useAuth();
  const { clubs, clubsLoading, myMemberships, joinClub, leaveClub, memberCounts } = useClubs();
  const { mine: myClubs, discover: discoverClubs } = splitClubs(clubs, myMemberships.map((m) => m.club_id), memberCounts);
  const selectedClub = myClubs.find((club) => club.id === selectedClubId) ?? null;
  const { data: clubPosts, isLoading: clubPostsLoading } = useCommunityPosts('all', 'club', selectedClub?.id);
  const { data: clubRanks = [], isLoading: clubRanksLoading } = useClubRanks(clubTab === 'leaderboard' ? selectedClub?.id : undefined);
  
  // Tier presets
  const { presets: tierPresets, isLoading: tierPresetsLoading } = useTierPresets();
  const ratingSummaries = useRatingSummaries(tierPresets.map((preset) => preset.id));

  const tabs: { id: Tab; label: string }[] = [
    { id: 'feed', label: 'Feed' },
    { id: 'clubs', label: 'Clubs' },
    { id: 'presets', label: 'Presets' },
  ];
  const clubTabs: { id: ClubTab; label: string }[] = [
    { id: 'feed', label: 'Feed' },
    { id: 'chat', label: 'Chat' },
    { id: 'leaderboard', label: 'Ranks' },
  ];
  const onAir: Record<Tab, string> = { feed: 'Around the league', clubs: 'The league', presets: 'Listings' };

  const deleteMyPost = (postId: string) => {
    deletePost.mutate(postId, {
      onSuccess: () => toast.success('Post deleted'),
    });
  };

  // Community shared presets (preset_shared posts from the feed)
  const communitySharedPresets = communityPosts?.filter(p => p.type === 'preset_shared' && p.workout_data) || [];

  // Tier presets are now used instead of static TRENDING_WORKOUTS

  // Handle saving a workout
  const handleSaveWorkout = (workout: TrendingWorkout) => {
    addWorkout.mutate({
      name: workout.name,
      description: null,
      duration: workout.totalDuration,
      difficulty: workout.difficulty,
      phases: joinStoredPhases(workout.sections),
      combos: workout.combos || [],
      tags: workout.tags || [],
      is_preset: false,
      is_archived: false,
      times_completed: 0,
      last_used_at: null,
    }, {
      onSuccess: () => toast.success(`"${workout.name}" saved to your workouts!`),
      onError: () => toast.error(`Couldn't save "${workout.name}"`),
    });
    setSelectedWorkout(null);
  };

  const matchesPresetSearch = (preset: { name: string; tier: string }) => {
    const query = searchQuery.toLowerCase();
    return preset.name.toLowerCase().includes(query) || preset.tier.toLowerCase().includes(query);
  };

  // Open a copy of the workout in the builder
  const handleCustomizeWorkout = (workout: TrendingWorkout) => {
    navigate(`/build?ai=${encodeURIComponent(JSON.stringify(workout))}`);
  };

  // Handle saving a community shared workout
  const handleSaveCommunityWorkout = (post: CommunityPost) => {
    if (!post.workout_data) {
      toast.error('Workout data not available');
      return;
    }
    
    const data = post.workout_data as unknown as SharedWorkoutData;
    addWorkout.mutate({
      name: post.workout_name || post.custom_name || 'Shared Workout',
      description: data.description || null,
      duration: data.totalDuration || data.duration || 0,
      difficulty: data.difficulty || null,
      phases: data.phases || joinStoredPhases(data.sections ?? {}),
      combos: data.combos || [],
      tags: post.tags || [],
      is_preset: false,
      is_archived: false,
      times_completed: 0,
      last_used_at: null,
    }, {
      onSuccess: () => toast.success(`"${post.workout_name}" saved to your workouts!`),
      onError: () => toast.error(`Couldn't save "${post.workout_name}"`),
    });
  };

  const handleJoinClub = (clubId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      promptEmailLink('join clubs');
      return;
    }
    joinClub.mutate(clubId);
  };
  
  const handleLeaveClub = (clubId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    leaveClub.mutate(clubId);
  };

  // Helper to format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Club Detail View
  if (selectedClub) {
    return (
      <AppLayout>
        <BroadcastPage show="Club" onBack={() => setSelectedClubId(null)}>
          <div className="mt-3 plate plate-lime plate-bleed-l plate-bleed-r flex min-h-[4.5rem] w-full flex-col items-stretch px-4 py-1.5">
            <div role="heading" aria-level={1}>
              <FitText className="fx h-11" max={56}>{selectedClub.name}</FitText>
            </div>
            <p className="mt-0.5 text-[0.8125rem] font-bold uppercase tracking-[0.11em]">{memberLabel(selectedClub)}</p>
          </div>

          <PlateTabs<ClubTab> tabs={clubTabs} value={clubTab} onChange={setClubTab} className="px-4 pt-3" />

          {clubTab === 'feed' && (
            <div className="pt-2">
              {clubPostsLoading && <p className="lab px-4 py-8">Loading posts...</p>}
              {clubPosts?.map((post) => (
                <FeedPost
                  key={post.id}
                  post={post}
                  isMine={post.user_id === user?.id}
                  timeAgo={formatTimeAgo(post.created_at)}
                  onDelete={() => deleteMyPost(post.id)}
                  onSave={() => handleSaveCommunityWorkout(post)}
                />
              ))}
              {!clubPostsLoading && (!clubPosts || clubPosts.length === 0) && (
                <EmptyPlate
                  title="No posts shared to this club yet."
                  body={`Share a workout and select "${selectedClub.name}" as the destination!`}
                />
              )}
            </div>
          )}

          {/* Not built yet. There's nowhere for a message to go, so this doesn't take one. */}
          {clubTab === 'chat' && (
            <div data-testid="club-chat-placeholder">
              <EmptyPlate title="Club chat isn't built yet" body="To reach the club for now, share a workout to its feed." />
            </div>
          )}

          {clubTab === 'leaderboard' && (
            <div className="pt-3">
              <SectionChyron>Standings</SectionChyron>
              <div className="mt-1">
                {clubRanksLoading && <p className="lab px-4 py-8">Loading ranks...</p>}
                {!clubRanksLoading && clubRanks.length === 0 && <EmptyPlate title="No ranks yet" />}
                {clubRanks.map((member) => (
                  <div
                    key={member.userId}
                    className={cn(
                      'grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-surface-2 px-4 py-1.5',
                      member.isYou && 'bg-surface-1',
                    )}
                  >
                    <span className={cn('fx text-3xl', member.isYou && 'text-volt')}>{member.rank}</span>
                    <span className="flex min-w-0 items-center gap-2.5">
                      {member.avatarUrl && <img src={member.avatarUrl} alt="" className="art-slant h-9 w-11 shrink-0 object-cover" />}
                      <span className={cn('fx min-w-0 break-words text-3xl', member.isYou && 'text-volt')}>
                        {member.name}{member.isYou && ' (You)'}
                      </span>
                    </span>
                    <span className={cn('fx whitespace-nowrap text-2xl', member.isYou && 'text-volt')}>{member.xp.toLocaleString()} XP</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </BroadcastPage>
      </AppLayout>
    );
  }

  // Main Fight Club View
  const hasFeedPosts = !!communityPosts && communityPosts.length > 0;
  return (
    <AppLayout>
      <BroadcastPage show={onAir[activeTab]}>
        <h1 className="sr-only">Fight Club</h1>
        <PlateTabs<Tab> tabs={tabs} value={activeTab} onChange={setActiveTab} className="px-4 pt-3" />

        {activeTab === 'feed' && (
          <div className="pt-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4">
              <h2 className="fx text-4xl">Highlights</h2>
              <div className="flex items-center gap-3">
                <PlateTabs<'all' | 'following'>
                  size="chip"
                  tabs={[{ id: 'all', label: 'All' }, { id: 'following', label: 'Following' }]}
                  value={feedFilter}
                  onChange={setFeedFilter}
                />
                <button
                  type="button"
                  aria-label="Find fighters"
                  onClick={() => {
                    if (isGuest) {
                      promptEmailLink('find other fighters');
                      return;
                    }
                    setShowUserSearch(true);
                  }}
                  className="plate plate-steel h-11 w-12"
                >
                  <UserPlus className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Not built yet, and labelled as such rather than faked with a demo stream */}
            {showLivePreview && <LiveStreamPreview onClose={() => setShowLivePreview(false)} />}
            {feedFilter === 'all' && (
              <section className="mt-3 border-l-4 border-surface-3 bg-surface-1 px-4 py-3" data-testid="live-training-placeholder">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <h3 className="fx text-3xl">Live training</h3>
                  <Plate tone="steel" className="h-8 px-3 text-xl">Coming soon</Plate>
                </div>
                <p className="prose-w mt-1 text-base">Streaming a session and training together isn't built yet.</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowLivePreview(true)}>
                  See the preview
                </Button>
              </section>
            )}

            {communityPosts?.map((post) => (
              <FeedPost
                key={post.id}
                post={post}
                isMine={post.user_id === user?.id}
                timeAgo={formatTimeAgo(post.created_at)}
                onDelete={() => deleteMyPost(post.id)}
                onSave={() => handleSaveCommunityWorkout(post)}
                onOpenProfile={() => navigate(`/profile/${post.user_id}`)}
              />
            ))}

            {postsLoading && <p className="lab px-4 py-8">Loading posts...</p>}

            {/* The community feed is only readable with an account */}
            {isGuest && <EmptyPlate title="Off air" body="Sign in with an email link to see the community feed." />}

            {!isGuest && !postsLoading && !hasFeedPosts && feedFilter === 'following' && (
              <EmptyPlate title="No posts from people you follow yet." body="Follow more fighters to see their posts here!" />
            )}
            {!isGuest && !postsLoading && !hasFeedPosts && feedFilter === 'all' && (
              <EmptyPlate title="No posts yet" body="When a fighter finishes a session or shares a workout, it runs here." />
            )}
          </div>
        )}

        {activeTab === 'clubs' && (
          <div className="pt-3">
            {myClubs.length > 0 && (
              <section className="pb-5">
                <h2 className="fx mb-2 px-4 text-4xl">My Fight Clubs</h2>
                <div className="space-y-3">
                  {myClubs.map((club) => (
                    <div key={club.id} className="card-workout p-0 pb-3">
                      <button
                        type="button"
                        onClick={() => setSelectedClubId(club.id)}
                        className="plate plate-lime plate-bleed-l plate-bleed-r flex min-h-16 w-full px-4 py-1.5"
                      >
                        <FitText className="fx h-12" max={60}>{club.name}</FitText>
                      </button>
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 pt-2">
                        <span className="lab lab-w">{memberLabel(club)}</span>
                        {club.memberCap !== null && (
                          <SegmentBar total={club.memberCap} filled={club.memberCount} height="1rem" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 px-5 pt-2">
                        <span className="lab lab-lime">Member</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => handleLeaveClub(club.id, e)}
                          disabled={leaveClub.isPending}
                        >
                          Leave
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="fx border-b border-surface-3 px-4 pb-1 text-4xl">Discover</h2>

              {discoverClubs.length === 0 && myClubs.length > 0 && (
                <p className="prose-w px-4 py-4 text-lg">You're in all available clubs!</p>
              )}

              {discoverClubs.map((club) => (
                <div
                  key={club.id}
                  className="card-workout grid bg-transparent grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-surface-2 p-0 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <h3 className="fx break-words text-4xl">{club.name}</h3>
                    {/* Membership is only readable with an account, so guests have no real count to show */}
                    {!isGuest && (
                      <>
                        <p className="lab mt-1">{memberLabel(club)}</p>
                        {club.isFull ? (
                          <p className="lab mt-0.5 text-destructive">Club full</p>
                        ) : club.spotsRemaining !== null && (
                          <p className="lab lab-lime mt-0.5">
                            {club.spotsRemaining} {club.spotsRemaining === 1 ? 'spot' : 'spots'} remaining!
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => handleJoinClub(club.id, e)}
                    disabled={joinClub.isPending || club.isFull}
                  >
                    {joinClub.isPending ? 'Joining...' : 'Join'}
                  </Button>
                </div>
              ))}

              {discoverClubs.length === 0 && myClubs.length === 0 && (
                <p className="prose-w px-4 py-4 text-lg">
                  {clubsLoading ? 'Loading clubs...' : isBackendConfigured ? 'No clubs yet.' : 'Clubs need a connected backend.'}
                </p>
              )}
            </section>
          </div>
        )}

        {activeTab === 'presets' && (
          <div className="pt-2">
            <div className="relative mx-4">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workouts..."
                aria-label="Search workouts"
                className="pl-6"
              />
            </div>

            <PlateTabs<WorkoutCategory>
              size="chip"
              tabs={WORKOUT_CATEGORIES.map((tag) => ({ id: tag, label: tag }))}
              value={selectedCategory}
              onChange={setSelectedCategory}
              className="scrollbar-hide overflow-x-auto px-4 py-2 sm:flex-wrap sm:overflow-visible"
            />

            <SectionChyron className="mb-1 mt-1">Trending</SectionChyron>

            {communitySharedPresets
              .filter((post) => {
                if (!searchQuery) return true;
                const pname = (post.custom_name || post.workout_name || '').toLowerCase();
                return pname.includes(searchQuery.toLowerCase());
              })
              .map((post) => (
                <ListingRow
                  key={post.id}
                  minutes={post.workout_data?.totalDuration ? Math.floor(post.workout_data.totalDuration / 60) : null}
                  title={post.custom_name || post.workout_name}
                  meta={<>
                    <span className="lab">by {post.user_name}</span>
                    <span className="lab">{post.likes} {post.likes === 1 ? 'like' : 'likes'}</span>
                  </>}
                  action={<><Download className="h-5 w-5" /><span className="sr-only">Save workout</span></>}
                  onClick={() => handleSaveCommunityWorkout(post)}
                />
              ))}

            {tierPresetsLoading ? (
              <p className="lab px-4 py-8">Loading presets...</p>
            ) : tierPresets.length === 0 ? (
              <EmptyPlate title="No presets available." />
            ) : (
              <>
                {!tierPresets.some(matchesPresetSearch) && (
                  <p className="prose-w px-4 py-8 text-lg">No workouts match "{searchQuery}".</p>
                )}
                {tierPresets
                  .filter(matchesPresetSearch)
                  .filter((preset) => {
                    if (selectedCategory === 'All') return true;
                    if (selectedCategory === 'Boxing') return true; // All presets are boxing
                    if (selectedCategory === 'Rookie') return preset.tier === 'rookie';
                    if (selectedCategory === 'Beginner') return preset.tier === 'beginner';
                    if (selectedCategory === 'Intermediate') return preset.tier === 'intermediate';
                    if (selectedCategory === 'Advanced') return preset.tier === 'advanced';
                    if (selectedCategory === 'Pro') return preset.tier === 'pro';
                    if (selectedCategory === 'HIIT') return ['intermediate', 'advanced', 'pro'].includes(preset.tier);
                    if (selectedCategory === 'Conditioning') return true;
                    if (selectedCategory === 'Cardio') return true;
                    return true;
                  })
                  .map((preset) => {
                    const ratingLabel = formatRating(ratingSummaries[preset.id], !!user);
                    return (
                      <ListingRow
                        key={preset.id}
                        minutes={Math.round(preset.generatedLoadout.duration / 60)}
                        title={preset.name}
                        tags={preset.generatedLoadout.tags}
                        meta={<>
                          <span className="lab">@nate</span>
                          <span className="lab lab-w">{preset.tier}</span>
                          {ratingLabel && (
                            <span className="lab flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current text-volt" />
                              {ratingLabel}
                            </span>
                          )}
                        </>}
                        action={<ChevronRight className="h-5 w-5" />}
                        onClick={() => {
                          // Convert tier preset to TrendingWorkout for the preview modal
                          const loadout = preset.generatedLoadout;
                          const { sections } = splitStoredPhases(loadout.phases);
                          const asTrending: TrendingWorkout = {
                            id: preset.id,
                            name: preset.name,
                            icon: '🥊',
                            difficulty: preset.tier as TrendingWorkout['difficulty'],
                            totalDuration: loadout.duration,
                            isPreset: true,
                            isArchived: false,
                            createdAt: new Date(preset.created_at),
                            timesCompleted: 0,
                            sections,
                            combos: loadout.combos,
                            tags: loadout.tags || [],
                            author: 'Nate',
                            authorHandle: '@nate',
                            rating: 0,
                            ratingCount: 0,
                            downloads: 0,
                          };
                          setSelectedWorkout(asTrending);
                        }}
                      />
                    );
                  })}
              </>
            )}
          </div>
        )}
      </BroadcastPage>

      {/* Workout Preview Modal */}
      {selectedWorkout && (
        <WorkoutPreviewModal
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
          onSave={handleSaveWorkout}
          onCustomize={handleCustomizeWorkout}
        />
      )}

      {/* User Search Modal */}
      {showUserSearch && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <BroadcastPage
            show="Scouting"
            air={
              <button
                type="button"
                aria-label="Close"
                onClick={() => { setShowUserSearch(false); setUserSearchQuery(''); }}
                className="plate plate-graphite h-11 w-12"
              >
                <X className="h-5 w-5" />
              </button>
            }
          >
            <div className="px-4 pt-3">
              <div role="heading" aria-level={2}>
                <FitText className="fx h-14" max={72}>Find Fighters</FitText>
              </div>
              <Input
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search by name or @handle..."
                aria-label="Search by name or @handle"
                className="mt-2"
                autoFocus
              />
            </div>

            <div className="pb-4 pt-2">
              {searchLoading && hasQuery && <p className="lab px-4 py-8">Searching...</p>}

              {!hasQuery && (
                <EmptyPlate title="Search for fighters to follow" body="Enter at least 2 characters" />
              )}

              {hasQuery && !searchLoading && searchResults.length === 0 && (
                <p className="prose-w px-4 py-8 text-lg">No fighters found matching "{userSearchQuery}"</p>
              )}

              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setShowUserSearch(false);
                    setUserSearchQuery('');
                    navigate(`/profile/${user.user_id}`);
                  }}
                  className="block w-full border-b border-surface-2 py-2.5 text-left transition-colors hover:bg-surface-1"
                >
                  <span className="plate plate-steel plate-bleed-l fx flex h-12 w-[min(22rem,88%)] justify-start pl-4 pr-6 text-3xl">
                    <span className="truncate">{user.name}</span>
                  </span>
                  <span className="lab mt-1.5 block px-4">
                    @{user.handle || user.name.toLowerCase().replace(/\s+/g, '')}
                  </span>
                </button>
              ))}
            </div>
          </BroadcastPage>
        </div>
      )}
    </AppLayout>
  );
};

export default FightClub;
