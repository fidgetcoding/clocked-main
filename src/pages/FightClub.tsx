import type { StoredPhase } from '@/lib/storedPhases';
import type { WorkoutSection } from '@/types';
import { joinStoredPhases, splitStoredPhases } from '@/lib/storedPhases';
import { useState } from 'react';
import { ArrowLeft, Users, Newspaper, Trophy, Search, MessageCircle, BarChart3, ChevronRight, Download, X, UserPlus, LogIn, LogOut, Trash2, Star, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
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

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'feed', label: 'Feed', icon: Newspaper },
    { id: 'clubs', label: 'Clubs', icon: Users },
    { id: 'presets', label: 'Presets', icon: Trophy },
  ];

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
        <div className="min-h-screen flex flex-col">
          {/* Club Header */}
          <header className="px-4 py-4 safe-top border-b border-surface-3">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setSelectedClubId(null)} className="text-muted-foreground">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-xl">
                {selectedClub.icon}
              </div>
              <div className="flex-1">
                <h1 className="font-bold text-foreground">{selectedClub.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {memberLabel(selectedClub)}
                </p>
              </div>
            </div>

            {/* Club Tabs */}
            <div className="flex gap-2">
              {[
                { id: 'feed' as ClubTab, label: 'Feed', icon: Newspaper },
                { id: 'chat' as ClubTab, label: 'Chat', icon: MessageCircle },
                { id: 'leaderboard' as ClubTab, label: 'Ranks', icon: BarChart3 },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setClubTab(tab.id)}
                    className={cn(
                      'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
                      clubTab === tab.id
                        ? 'bg-volt text-primary-foreground'
                        : 'bg-surface-1 text-muted-foreground hover:bg-surface-2'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </header>

          {/* Club Content */}
          <div className="flex-1 overflow-y-auto">
            {clubTab === 'feed' && (
              <div className="px-4 py-4 space-y-4">
                {clubPostsLoading && (
                  <div className="text-center py-8 text-muted-foreground">Loading posts...</div>
                )}
                {clubPosts && clubPosts.length > 0 && clubPosts.map((post) => (
                  <div key={post.id} className="card-workout">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
                        {post.user_avatar ? (
                          <img src={post.user_avatar} alt="" className="w-full h-full object-cover" />
                        ) : '🥊'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{post.user_name}</span>
                          <span className="text-xs text-muted-foreground">{formatTimeAgo(post.created_at)}</span>
                          {post.user_id === user?.id && (
                            <button
                              onClick={() => {
                                deletePost.mutate(post.id, {
                                  onSuccess: () => toast.success('Post deleted'),
                                });
                              }}
                              className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {post.type === 'preset_shared' && (
                          <>
                            <p className="text-sm text-foreground mt-1">
                              Shared a workout: <span className="text-volt font-medium">{post.custom_name || post.workout_name}</span> 🥊
                            </p>
                            {post.tags && post.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {post.tags.map((tag) => (
                                  <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-volt/15 text-volt border border-volt/20">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {post.message && (
                              <p className="text-sm text-muted-foreground mt-2 italic">"{post.message}"</p>
                            )}
                            <div className="flex items-center gap-2 mt-3">
                              <Button 
                                size="sm" 
                                className="bg-volt text-primary-foreground text-xs"
                                onClick={() => handleSaveCommunityWorkout(post)}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Save Workout
                              </Button>
                            </div>
                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              <span>❤️ {post.likes}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!clubPostsLoading && (!clubPosts || clubPosts.length === 0) && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No posts shared to this club yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">Share a workout and select "{selectedClub.name}" as the destination!</p>
                  </div>
                )}
              </div>
            )}

            {/* Not built yet. There's nowhere for a message to go, so this doesn't take one. */}
            {clubTab === 'chat' && (
              <div className="px-4 py-12 text-center" data-testid="club-chat-placeholder">
                <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-semibold">Club chat isn't built yet</p>
                <p className="text-sm text-muted-foreground mt-1">To reach the club for now, share a workout to its feed.</p>
              </div>
            )}

            {clubTab === 'leaderboard' && (
              <div className="px-4 py-4 space-y-2">
                {clubRanksLoading && (
                  <div className="text-center py-8 text-muted-foreground">Loading ranks...</div>
                )}
                {clubRanks.map((member) => (
                  <div 
                    key={member.userId} 
                    className={cn(
                      'card-workout flex items-center gap-3',
                      member.isYou && 'border-volt'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                      member.rank === 1 ? 'bg-yellow-500 text-black' :
                      member.rank === 2 ? 'bg-gray-400 text-black' :
                      member.rank === 3 ? 'bg-orange-600 text-white' :
                      'bg-surface-2 text-muted-foreground'
                    )}>
                      {member.rank}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-xl relative overflow-hidden">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : '🥊'}
                    </div>
                    <div className="flex-1">
                      <p className={cn('font-semibold', member.isYou ? 'text-volt' : 'text-foreground')}>
                        {member.name}{member.isYou && ' (You)'}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.xp.toLocaleString()} XP</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  // Main Fight Club View
  return (
    <AppLayout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <header className="px-4 py-4 safe-top border-b border-surface-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-foreground">Fight Club</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all',
                    activeTab === tab.id
                      ? 'bg-volt text-primary-foreground'
                      : 'bg-surface-1 text-muted-foreground hover:bg-surface-2'
                  )}
                >
                  <Icon className="w-4 h-4 mx-auto mb-1" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* Content */}
        <div className="px-4 py-4">
          {activeTab === 'feed' && (
            <div className="space-y-4">
              {/* Feed Filter Toggle + Search */}
              <div className="flex gap-2 items-center">
                <div className="flex gap-2 p-1 bg-surface-1 rounded-lg flex-1">
                  <button
                    onClick={() => setFeedFilter('all')}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all',
                      feedFilter === 'all'
                        ? 'bg-volt text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFeedFilter('following')}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all',
                      feedFilter === 'following'
                        ? 'bg-volt text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Following
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (isGuest) {
                      promptEmailLink('find other fighters');
                      return;
                    }
                    setShowUserSearch(true);
                  }}
                  className="w-10 h-10 rounded-lg bg-surface-1 flex items-center justify-center text-muted-foreground hover:text-volt hover:bg-surface-2 transition-colors"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
              
              {/* Real community posts */}
              {communityPosts && communityPosts.length > 0 && communityPosts.map((post) => (
                <div key={post.id} className="card-workout">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
                      {post.user_avatar ? (
                        <img src={post.user_avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        '🥊'
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/profile/${post.user_id}`)}
                          className="font-semibold text-foreground hover:text-volt transition-colors"
                        >
                          {post.user_name}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(post.created_at)}
                        </span>
                        {/* Delete button for own posts */}
                        {post.user_id === user?.id && (
                          <button
                            onClick={() => {
                              deletePost.mutate(post.id, {
                                onSuccess: () => toast.success('Post deleted'),
                              });
                            }}
                            className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {post.type === 'workout_complete' && (
                        <>
                          <p className="text-sm text-foreground mt-1">
                            {post.message || `Completed "${post.workout_name}" 🔥`}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span>❤️ {post.likes}</span>
                          </div>
                        </>
                      )}

                      {post.type === 'preset_shared' && (
                        <>
                          <p className="text-sm text-foreground mt-1">
                            Shared a workout: <span className="text-volt font-medium">{post.custom_name || post.workout_name}</span> 🥊
                          </p>
                          {post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {post.tags.map((tag) => (
                                <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-volt/15 text-volt border border-volt/20">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {post.message && (
                            <p className="text-sm text-muted-foreground mt-2 italic">"{post.message}"</p>
                          )}
                          <div className="flex items-center gap-2 mt-3">
                            <Button 
                              size="sm" 
                              className="bg-volt text-primary-foreground text-xs"
                              onClick={() => handleSaveCommunityWorkout(post)}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Save Workout
                            </Button>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span>❤️ {post.likes}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading state */}
              {postsLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  Loading posts...
                </div>
              )}

              {/* The community feed is only readable with an account */}
              {isGuest && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Sign in with an email link to see the community feed.</p>
                </div>
              )}

              {/* Empty state for Following filter */}
              {!isGuest && !postsLoading && feedFilter === 'following' && (!communityPosts || communityPosts.length === 0) && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No posts from people you follow yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">Follow more fighters to see their posts here!</p>
                </div>
              )}

              {/* Not built yet, and labelled as such rather than faked with a demo stream */}
              {showLivePreview && <LiveStreamPreview onClose={() => setShowLivePreview(false)} />}
              {feedFilter === 'all' && (
                <div className="card-workout" data-testid="live-training-placeholder">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0">
                      <Radio className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground">Live training</h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground">
                          Coming soon
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Streaming a session and training together isn't built yet.
                      </p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowLivePreview(true)}>
                        See the preview
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

{activeTab === 'clubs' && (
            <div className="space-y-4">
              {/* My Clubs Section */}
              {myClubs.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      My Fight Clubs
                    </h3>
                  </div>

                  {myClubs.map((club) => (
                    <div
                      key={club.id}
                      className="card-workout w-full"
                    >
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setSelectedClubId(club.id)}
                          className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-2xl hover:ring-2 hover:ring-volt transition-all"
                        >
                          {club.icon}
                        </button>
                        <button 
                          onClick={() => setSelectedClubId(club.id)}
                          className="flex-1 text-left"
                        >
                          <h4 className="font-semibold text-foreground hover:text-volt transition-colors">{club.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {memberLabel(club)}
                          </p>
                          <p className="text-xs text-volt mt-1">Member ✓</p>
                        </button>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleLeaveClub(club.id, e)}
                            disabled={leaveClub.isPending}
                            className="text-xs border-surface-3 hover:border-destructive hover:text-destructive"
                          >
                            <LogOut className="w-3 h-3 mr-1" />
                            Leave
                          </Button>
                          <button onClick={() => setSelectedClubId(club.id)}>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Discover Section */}
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-2">
                Discover
              </h3>

              {discoverClubs.length === 0 && myClubs.length > 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  You're in all available clubs! 🎉
                </p>
              )}

              {discoverClubs.map((club) => (
                <div
                  key={club.id}
                  className="card-workout w-full"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-2xl">
                      {club.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{club.name}</h4>
                      {/* Membership is only readable with an account, so guests have no real count to show */}
                      {!isGuest && (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {memberLabel(club)}
                          </p>
                          {club.isFull ? (
                            <p className="text-xs text-destructive mt-1">
                              Club full
                            </p>
                          ) : club.spotsRemaining !== null && (
                            <p className="text-xs text-volt mt-1">
                              {club.spotsRemaining} {club.spotsRemaining === 1 ? 'spot' : 'spots'} remaining! 🔥
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => handleJoinClub(club.id, e)}
                      disabled={joinClub.isPending || club.isFull}
                      className="bg-volt text-primary-foreground text-xs"
                    >
                      <LogIn className="w-3 h-3 mr-1" />
                      {joinClub.isPending ? 'Joining...' : 'Join'}
                    </Button>
                  </div>
                </div>
              ))}

              {/* Empty state when no clubs */}
              {discoverClubs.length === 0 && myClubs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {clubsLoading ? 'Loading clubs...' : isBackendConfigured ? 'No clubs yet.' : 'Clubs need a connected backend.'}
                </p>
              )}
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search workouts..."
                  className="w-full h-10 pl-9 pr-4 rounded-lg bg-surface-1 border border-surface-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-volt"
                />
              </div>

              {/* Category Filters */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                {WORKOUT_CATEGORIES.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedCategory(tag)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors',
                      selectedCategory === tag
                        ? 'bg-volt text-primary-foreground font-semibold'
                        : 'bg-surface-1 text-muted-foreground hover:bg-surface-2'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Trending — Tier Presets */}
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Trending 🔥
              </h3>

              {/* Community shared presets */}
              {communitySharedPresets
                .filter((post) => {
                  if (!searchQuery) return true;
                  const pname = (post.custom_name || post.workout_name || '').toLowerCase();
                  return pname.includes(searchQuery.toLowerCase());
                })
                .map((post) => (
                <button
                  key={post.id}
                  onClick={() => handleSaveCommunityWorkout(post)}
                  className="card-workout w-full text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-volt/20 flex items-center justify-center text-2xl">
                      {post.workout_data?.icon || '🥊'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{post.custom_name || post.workout_name}</h4>
                      <p className="text-sm text-muted-foreground">by {post.user_name}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {post.workout_data?.totalDuration && (
                          <span>{Math.floor(post.workout_data.totalDuration / 60)} min</span>
                        )}
                        <span>❤️ {post.likes}</span>
                      </div>
                    </div>
                    <Download className="w-5 h-5 text-volt mt-1" />
                  </div>
                </button>
              ))}

              {/* Tier Preset Cards */}
              {tierPresetsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading presets...</div>
              ) : tierPresets.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No presets available.</p>
                </div>
              ) : (
                <>
                {!tierPresets.some(matchesPresetSearch) && (
                  <p className="text-center py-8 text-muted-foreground">No workouts match "{searchQuery}".</p>
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
                    const duration = Math.round(preset.generatedLoadout.duration / 60);
                    const tierLabel = preset.tier.charAt(0).toUpperCase() + preset.tier.slice(1);
                    const tierColor = preset.tier === 'rookie' ? 'text-slate-400' :
                      preset.tier === 'beginner' ? 'text-volt' :
                      preset.tier === 'intermediate' ? 'text-blue-400' :
                      preset.tier === 'advanced' ? 'text-purple-400' :
                      'text-amber-400';
                    const ratingLabel = formatRating(ratingSummaries[preset.id], !!user);

                    return (
                      <button
                        key={preset.id}
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
                        className="card-workout w-full text-left"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl bg-volt/20 flex items-center justify-center text-2xl">
                            🥊
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{preset.name}</h4>
                            <p className="text-sm text-muted-foreground">@nate</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                              {ratingLabel && (
                                <span className="flex items-center gap-0.5">
                                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                  {ratingLabel}
                                </span>
                              )}
                              <span>{duration} min</span>
                              <span className={cn("font-semibold", tierColor)}>
                                {tierLabel}
                              </span>
                            </div>
                            {preset.generatedLoadout.tags && preset.generatedLoadout.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {preset.generatedLoadout.tags.map((tag) => (
                                  <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-volt/15 text-volt border border-volt/20">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground mt-1" />
                        </div>
                      </button>
                    );
                  })
                }
                </>
              )}
            </div>
          )}
        </div>
      </div>

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
        <div className="fixed inset-0 bg-background/95 z-50 flex flex-col">
          <header className="flex items-center gap-3 px-4 py-4 border-b border-surface-3 safe-top">
            <button onClick={() => { setShowUserSearch(false); setUserSearchQuery(''); }} className="text-muted-foreground">
              <X className="w-6 h-6" />
            </button>
            <h2 className="font-bold text-foreground">Find Fighters</h2>
          </header>

          <div className="px-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search by name or @handle..."
                className="pl-10 bg-surface-1 border-surface-3"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {searchLoading && hasQuery && (
              <div className="text-center py-8 text-muted-foreground">
                Searching...
              </div>
            )}

            {!hasQuery && (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Search for fighters to follow</p>
                <p className="text-sm mt-1">Enter at least 2 characters</p>
              </div>
            )}

            {hasQuery && !searchLoading && searchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No fighters found matching "{userSearchQuery}"
              </div>
            )}

            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  setShowUserSearch(false);
                  setUserSearchQuery('');
                  navigate(`/profile/${user.user_id}`);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-1 border border-surface-3 hover:border-volt transition-colors mb-2"
              >
                <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    '🥊'
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-foreground">{user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    @{user.handle || user.name.toLowerCase().replace(/\s+/g, '')}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default FightClub;
