import { useState } from 'react';
import { ArrowLeft, Users, Newspaper, Trophy, Search, MessageCircle, BarChart3, Send, ChevronRight, Mic, MicOff, Download, X, UserPlus, LogIn, LogOut, Trash2, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { WORKOUT_CATEGORIES, TrendingWorkout, WorkoutCategory } from '@/data/trendingWorkouts';
import { WorkoutPreviewModal } from '@/components/WorkoutPreviewModal';
import { AIBuilderModal } from '@/components/AIBuilderModal';
import { LiveStreamModal } from '@/components/LiveStreamModal';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useCommunityPosts, CommunityPost, useDeleteCommunityPost } from '@/hooks/useCommunityPosts';
import { Workout } from '@/types';
import { toast } from 'sonner';
import { useUserSearch } from '@/hooks/useUserSearch';
import { useFollows } from '@/hooks/useFollows';
import { useClubs, EARLY_ADOPTERS_CLUB_ID } from '@/hooks/useClubs';
import { useAuth } from '@/contexts/AuthContext';
import { useTierPresets, TierPresetWithLoadout } from '@/hooks/useTierPresets';

type Tab = 'feed' | 'clubs' | 'presets';
type ClubTab = 'feed' | 'chat' | 'leaderboard';

interface Club {
  id: string;
  name: string;
  icon: string;
  type: 'public' | 'private';
  coach?: string;
  memberCount: number;
  activeNow: number;
  rank?: number;
}

const FightClub = () => {
  const navigate = useNavigate();
  const { addWorkout } = useWorkoutStore();
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all');
  const { data: communityPosts, isLoading: postsLoading } = useCommunityPosts(feedFilter, 'feed');
  const { data: clubPosts, isLoading: clubPostsLoading } = useCommunityPosts('all', 'club', EARLY_ADOPTERS_CLUB_ID);
  const deletePost = useDeleteCommunityPost();
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [clubTab, setClubTab] = useState<ClubTab>('feed');
  const [chatMessage, setChatMessage] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [clubChatMessages, setClubChatMessages] = useState<{id: string; userName: string; avatar: string; message: string; time: string; isOwn: boolean; isVoice?: boolean}[]>([]);
  // Presets tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory>('All');
  const [selectedWorkout, setSelectedWorkout] = useState<TrendingWorkout | null>(null);
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [customizeWorkout, setCustomizeWorkout] = useState<TrendingWorkout | undefined>(undefined);
  const [watchingStream, setWatchingStream] = useState<{userName: string; userAvatar: string; workoutName: string; elapsed: string} | null>(null);
  
  // User search state
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const { results: searchResults, isLoading: searchLoading, hasQuery } = useUserSearch(userSearchQuery);
  const { follow } = useFollows();
  
  // Clubs
  const { user } = useAuth();
  const { clubs, isMemberOf, joinClub, leaveClub, useClubMemberCount } = useClubs();
  const { data: earlyAdoptersMemberCount = 0 } = useClubMemberCount(EARLY_ADOPTERS_CLUB_ID);
  const earlyAdoptersClub = clubs.find(c => c.id === EARLY_ADOPTERS_CLUB_ID);
  
  // Tier presets
  const { presets: tierPresets, isLoading: tierPresetsLoading } = useTierPresets();

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
    const newWorkout = {
      ...workout,
      id: crypto.randomUUID(),
      isPreset: false,
      createdAt: new Date(),
      timesCompleted: 0,
    };
    addWorkout(newWorkout);
    toast.success(`"${workout.name}" saved to your workouts!`);
    setSelectedWorkout(null);
  };

  // Handle customizing a workout with AI
  const handleCustomizeWorkout = (workout: TrendingWorkout) => {
    setSelectedWorkout(null);
    setCustomizeWorkout(workout);
    setShowAIBuilder(true);
  };

  // Handle AI generation
  const handleAIGenerate = (prompt: string, baseWorkout?: TrendingWorkout) => {
    // For now, just navigate to build page - in future this would call AI
    toast.success('AI workout generation coming soon!');
    setShowAIBuilder(false);
    setCustomizeWorkout(undefined);
    navigate('/build');
  };

  // Handle saving a community shared workout
  const handleSaveCommunityWorkout = (post: CommunityPost) => {
    if (!post.workout_data) {
      toast.error('Workout data not available');
      return;
    }
    
    const workout: Workout = {
      ...post.workout_data,
      id: crypto.randomUUID(),
      isPreset: false,
      createdAt: new Date(),
      timesCompleted: 0,
    };
    addWorkout(workout);
    toast.success(`"${post.workout_name}" saved to your workouts!`);
  };

  // Clubs data - Build from database
  const isEarlyAdopterMember = isMemberOf(EARLY_ADOPTERS_CLUB_ID);
  const earlyAdoptersCap = earlyAdoptersClub?.member_cap ?? 100;
  const spotsRemaining = earlyAdoptersCap - earlyAdoptersMemberCount;
  
  const myClubs: Club[] = isEarlyAdopterMember && earlyAdoptersClub
    ? [{ 
        id: earlyAdoptersClub.id, 
        name: earlyAdoptersClub.name, 
        icon: earlyAdoptersClub.icon, 
        type: earlyAdoptersClub.type as 'public' | 'private', 
        memberCount: earlyAdoptersMemberCount, 
        activeNow: 0 
      }]
    : [];

  const discoverClubs: Club[] = !isEarlyAdopterMember && earlyAdoptersClub
    ? [{ 
        id: earlyAdoptersClub.id, 
        name: earlyAdoptersClub.name, 
        icon: earlyAdoptersClub.icon, 
        type: earlyAdoptersClub.type as 'public' | 'private', 
        memberCount: earlyAdoptersMemberCount, 
        activeNow: 0 
      }]
    : [];
  
  const handleJoinClub = (clubId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please sign in to join clubs');
      navigate('/auth');
      return;
    }
    joinClub.mutate(clubId);
  };
  
  const handleLeaveClub = (clubId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    leaveClub.mutate(clubId);
  };

  // Demo feed post - shows LIVE feature example
  type MockFeedPost = {
    id: string;
    userName: string;
    avatar: string;
    status: 'live' | 'active';
    type: 'currently_training' | 'workout_complete' | 'rank_up';
    workoutName?: string;
    elapsed?: string;
    xpEarned?: number;
    message?: string;
    timeAgo?: string;
    likes?: number;
    comments?: number;
    newRank?: string;
  };
  
  const mockFeedPosts: MockFeedPost[] = [
    { id: 'demo-live', userName: 'Demo', status: 'live', type: 'currently_training', workoutName: 'Heavy Bag Blast', elapsed: '18:34', avatar: '🤖' },
  ];

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

  // Club-specific data - empty for now, will be populated from database
  // Club feed uses real club-destination posts

  // Voice recording for chat
  const handleVoiceRecord = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return;
    }
    
    if (isRecordingVoice) {
      setIsRecordingVoice(false);
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        const newMessage = {
          id: crypto.randomUUID(),
          userName: 'You',
          avatar: '⚡',
          message: transcript,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOwn: true,
          isVoice: true,
        };
        setClubChatMessages(prev => [...prev, newMessage]);
      }
      setIsRecordingVoice(false);
    };
    
    recognition.onerror = () => setIsRecordingVoice(false);
    recognition.onend = () => setIsRecordingVoice(false);
    
    recognition.start();
    setIsRecordingVoice(true);
  };

  const handleSendClubMessage = () => {
    if (!chatMessage.trim()) return;
    const newMessage = {
      id: crypto.randomUUID(),
      userName: 'You',
      avatar: '⚡',
      message: chatMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
    };
    setClubChatMessages(prev => [...prev, newMessage]);
    setChatMessage('');
  };

  // Club leaderboard - empty for now, will be populated from database
  const clubLeaderboard: {rank: number; name: string; xp: number; avatar: string; isLive: boolean; isYou?: boolean}[] = [];

  // Club Detail View
  if (selectedClub) {
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col">
          {/* Club Header */}
          <header className="px-4 py-4 safe-top border-b border-surface-3">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setSelectedClub(null)} className="text-muted-foreground">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-xl">
                {selectedClub.icon}
              </div>
              <div className="flex-1">
                <h1 className="font-bold text-foreground">{selectedClub.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {selectedClub.memberCount} members · {selectedClub.activeNow} active now
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
                    <p className="text-sm text-muted-foreground mt-1">Share a workout and select "Early Adopters" as the destination!</p>
                  </div>
                )}
              </div>
            )}

            {clubTab === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
                  {clubChatMessages.map((msg) => (
                    <button 
                      key={msg.id} 
                      onClick={() => msg.userName !== 'You' && navigate(`/profile/${msg.userName.toLowerCase().replace(/\s+/g, '-').replace('.', '')}`)}
                      className={cn('flex gap-3 w-full text-left', msg.isOwn && 'flex-row-reverse')}
                    >
                      <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-lg flex-shrink-0 hover:ring-2 hover:ring-volt transition-all">
                        {msg.avatar}
                      </div>
                      <div className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-2',
                        msg.isOwn ? 'bg-volt text-primary-foreground' : 'bg-surface-1'
                      )}>
                        {!msg.isOwn && (
                          <p className="text-xs text-muted-foreground mb-1 hover:text-volt transition-colors">{msg.userName}</p>
                        )}
                        <div className="flex items-center gap-1">
                          {(msg as any).isVoice && <Mic className="w-3 h-3 text-volt" />}
                          <p className={cn('text-sm', msg.isOwn ? 'text-primary-foreground' : 'text-foreground')}>
                            {msg.message}
                          </p>
                        </div>
                        <p className={cn('text-xs mt-1', msg.isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                          {msg.time}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Chat Input with Voice */}
                <div className="px-4 py-4 border-t border-surface-3 safe-bottom">
                  <div className="flex gap-2">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendClubMessage()}
                      placeholder="Type a message..."
                      className="flex-1 bg-surface-1 border-surface-3"
                    />
                    <Button 
                      onClick={handleVoiceRecord}
                      variant="outline"
                      className={cn(
                        "px-3 border-surface-3",
                        isRecordingVoice && "bg-volt text-primary-foreground border-volt animate-pulse"
                      )}
                    >
                      {isRecordingVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                    <Button onClick={handleSendClubMessage} className="bg-volt text-primary-foreground px-4">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {clubTab === 'leaderboard' && (
              <div className="px-4 py-4 space-y-2">
                {clubLeaderboard.map((member) => (
                  <div 
                    key={member.rank} 
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
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-xl relative">
                      {member.avatar}
                      {member.isLive && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-volt rounded-full border-2 border-background" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={cn('font-semibold', member.isYou ? 'text-volt' : 'text-foreground')}>
                        {member.name} {member.isYou && '(You)'}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.xp.toLocaleString()} XP</p>
                    </div>
                    {member.isLive && (
                      <span className="text-xs text-volt font-medium">LIVE</span>
                    )}
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
                  onClick={() => setShowUserSearch(true)}
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

              {/* Empty state for Following filter */}
              {!postsLoading && feedFilter === 'following' && (!communityPosts || communityPosts.length === 0) && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No posts from people you follow yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">Follow more fighters to see their posts here!</p>
                </div>
              )}

              {/* Mock feed posts as demo/fallback - only show on "All" tab */}
              {feedFilter === 'all' && mockFeedPosts.map((post) => (
                <div key={post.id} className="card-workout">
                  <div className="flex items-start gap-3">
                    {/* Clickable Avatar */}
                    <button 
                      onClick={() => navigate(`/profile/${post.userName.toLowerCase().replace(/\s+/g, '-')}`)}
                      className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-xl hover:ring-2 hover:ring-volt transition-all flex-shrink-0"
                    >
                      {post.avatar}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => navigate(`/profile/${post.userName.toLowerCase().replace(/\s+/g, '-')}`)}
                          className="font-semibold text-foreground hover:text-volt transition-colors"
                        >
                          {post.userName}
                        </button>
                        {post.status === 'live' && (
                          <span className="flex items-center gap-1 text-xs text-volt font-medium">
                            <span className="w-2 h-2 rounded-full bg-volt animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>

                      {post.type === 'currently_training' && (
                        <>
                          <p className="text-sm text-muted-foreground mt-1">
                            Currently doing: <span className="text-foreground">{post.workoutName}</span>
                          </p>
                          <p className="text-xs text-volt mt-1">{post.elapsed} elapsed</p>
                          <Button 
                            size="sm" 
                            className="mt-2 bg-surface-2 hover:bg-surface-3 text-foreground text-xs"
                            onClick={() => setWatchingStream({
                              userName: post.userName,
                              userAvatar: post.avatar,
                              workoutName: post.workoutName!,
                              elapsed: post.elapsed!,
                            })}
                          >
                            Watch
                          </Button>
                        </>
                      )}

                      {post.type === 'workout_complete' && (
                        <>
                          <p className="text-sm text-foreground mt-1">
                            Completed "{post.workoutName}" 🔥
                          </p>
                          <p className="text-xs text-volt">{post.xpEarned} XP earned</p>
                          {post.message && (
                            <p className="text-sm text-muted-foreground mt-2 italic">"{post.message}"</p>
                          )}
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span>❤️ {post.likes}</span>
                            <span>💬 {post.comments}</span>
                            <span className="ml-auto">{post.timeAgo}</span>
                          </div>
                        </>
                      )}

                      {post.type === 'rank_up' && (
                        <>
                          <p className="text-sm text-foreground mt-1">
                            Ranked up to <span className="text-volt font-bold">{post.newRank}</span>! 🏆
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span>❤️ {post.likes}</span>
                            <span>💬 {post.comments}</span>
                            <span className="ml-auto">{post.timeAgo}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
                          onClick={() => setSelectedClub(club)}
                          className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-2xl hover:ring-2 hover:ring-volt transition-all"
                        >
                          {club.icon}
                        </button>
                        <button 
                          onClick={() => setSelectedClub(club)}
                          className="flex-1 text-left"
                        >
                          <h4 className="font-semibold text-foreground hover:text-volt transition-colors">{club.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {club.memberCount} / {earlyAdoptersCap} members
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
                          <button onClick={() => setSelectedClub(club)}>
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
                      <p className="text-sm text-muted-foreground">
                        {club.memberCount} / {earlyAdoptersCap} members
                      </p>
                      {spotsRemaining > 0 ? (
                        <p className="text-xs text-volt mt-1">
                          {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} remaining! 🔥
                        </p>
                      ) : (
                        <p className="text-xs text-destructive mt-1">
                          Club full
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => handleJoinClub(club.id, e)}
                      disabled={joinClub.isPending || spotsRemaining <= 0}
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
                  Loading clubs...
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
                tierPresets
                  .filter((preset) => {
                    if (!searchQuery) return true;
                    return preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      preset.tier.toLowerCase().includes(searchQuery.toLowerCase());
                  })
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
                    const userCountDisplay = preset.userCount >= 1000 
                      ? `${(preset.userCount / 1000).toFixed(1)}K` 
                      : preset.userCount.toString();

                    return (
                      <button
                        key={preset.id}
                        onClick={() => {
                          // Navigate to workout session with one-off loadout
                          navigate('/workout/oneoff', { state: { 
                            oneOffLoadout: preset.generatedLoadout,
                            workoutName: preset.name,
                          }});
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
                              <span className="flex items-center gap-0.5">
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                5.0 ({userCountDisplay})
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Download className="w-3 h-3" />
                                {userCountDisplay}
                              </span>
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

      {/* AI Builder Modal */}
      {showAIBuilder && (
        <AIBuilderModal
          onClose={() => {
            setShowAIBuilder(false);
            setCustomizeWorkout(undefined);
          }}
          onGenerate={handleAIGenerate}
          baseWorkout={customizeWorkout}
        />
      )}

      {/* Live Stream Modal */}
      {watchingStream && (
        <LiveStreamModal
          userName={watchingStream.userName}
          userAvatar={watchingStream.userAvatar}
          workoutName={watchingStream.workoutName}
          elapsed={watchingStream.elapsed}
          onClose={() => setWatchingStream(null)}
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
