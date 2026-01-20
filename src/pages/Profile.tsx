import { useState } from 'react';
import { ArrowLeft, Settings, User, Users, Grid3X3, Bookmark, MapPin, Link as LinkIcon, UserPlus, UserCheck, Clock, Trophy, Flame, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/stores/userStore';
import { XPBar } from '@/components/ui/XPBar';
import { RANK_NAMES, Rank, RANK_THRESHOLDS } from '@/types';
import { cn } from '@/lib/utils';

function getCurrentRank(xp: number): Rank {
  const ranks = Object.entries(RANK_THRESHOLDS).reverse() as [Rank, number][];
  for (const [rank, threshold] of ranks) {
    if (xp >= threshold) return rank;
  }
  return 'regional';
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Mock data for other users
const MOCK_USERS: Record<string, any> = {
  'sarah-chen': {
    id: 'sarah-chen',
    name: 'Sarah Chen',
    handle: '@sarahfights',
    avatar: '👩',
    bio: 'Boxing enthusiast 🥊 | 3x Amateur Champion | Training daily',
    location: 'Los Angeles, CA',
    totalXP: 32000,
    workoutsCompleted: 156,
    currentStreak: 12,
    longestStreak: 45,
    totalWorkoutTime: 280800, // ~78 hours
    followers: 1245,
    following: 89,
    isFollowing: false,
    posts: [
      { id: '1', type: 'workout', name: 'Morning Blast', xp: 320, date: '2h ago' },
      { id: '2', type: 'rank_up', rank: 'Top 15', date: '3d ago' },
      { id: '3', type: 'workout', name: 'Heavy Bag Session', xp: 450, date: '5d ago' },
    ],
  },
  'mike-thompson': {
    id: 'mike-thompson',
    name: 'Mike Thompson',
    handle: '@ironmike',
    avatar: '👨',
    bio: 'Coach at Iron Fist Boxing | 15 years experience',
    location: 'New York, NY',
    totalXP: 89000,
    workoutsCompleted: 412,
    currentStreak: 28,
    longestStreak: 120,
    totalWorkoutTime: 842400, // ~234 hours
    followers: 5680,
    following: 156,
    isFollowing: true,
    posts: [
      { id: '1', type: 'workout', name: 'Pro Circuit Drill', xp: 520, date: '1h ago' },
      { id: '2', type: 'workout', name: 'Cardio Conditioning', xp: 380, date: '1d ago' },
    ],
  },
};

type ProfileTab = 'posts' | 'workouts' | 'saved';

const Profile = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const user = useUserStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [followingState, setFollowingState] = useState<Record<string, boolean>>({
    'mike-thompson': true,
  });

  // Determine if viewing own profile or someone else's
  const isOwnProfile = !userId;
  const viewingUser = isOwnProfile ? null : MOCK_USERS[userId];

  // Use real user data or mock for other profiles
  const totalXP = isOwnProfile ? (user?.totalXP || 247) : (viewingUser?.totalXP || 0);
  const currentRank = getCurrentRank(totalXP);
  const profileName = isOwnProfile ? (user?.name || 'Fighter') : (viewingUser?.name || 'Unknown');
  const profileHandle = isOwnProfile ? '@' + (user?.name?.toLowerCase().replace(/\s+/g, '') || 'fighter') : (viewingUser?.handle || '@unknown');
  const profileAvatar = isOwnProfile ? null : viewingUser?.avatar;

  // Mock followers for own profile
  const ownFollowers = [
    { id: 'sarah-chen', name: 'Sarah Chen', avatar: '👩', handle: '@sarahfights' },
    { id: 'mike-thompson', name: 'Mike Thompson', avatar: '👨', handle: '@ironmike' },
  ];

  const handleFollow = (id: string) => {
    setFollowingState(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const tabs: { id: ProfileTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'posts', label: 'Posts', icon: Grid3X3 },
    { id: 'workouts', label: 'Workouts', icon: Trophy },
    { id: 'saved', label: 'Saved', icon: Bookmark },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 safe-top border-b border-surface-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-muted-foreground">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-foreground">{profileName}</h1>
          </div>
          {isOwnProfile && (
            <button 
              onClick={() => navigate('/settings')}
              className="w-10 h-10 rounded-full bg-surface-1 border border-surface-3 flex items-center justify-center"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </header>

        {/* Profile Header Section */}
        <div className="px-4 py-6">
          <div className="flex items-start gap-4 mb-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-volt/20 flex items-center justify-center">
              {profileAvatar ? (
                <span className="text-4xl">{profileAvatar}</span>
              ) : (
                <User className="w-10 h-10 text-volt" />
              )}
            </div>

            {/* Stats Row */}
            <div className="flex-1 flex justify-around">
              <div className="text-center">
                <p className="text-xl font-bold text-foreground">
                  {isOwnProfile ? (user?.workoutsCompleted || 24) : (viewingUser?.workoutsCompleted || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Workouts</p>
              </div>
              <button 
                onClick={() => {/* Could open followers modal */}}
                className="text-center"
              >
                <p className="text-xl font-bold text-foreground">
                  {isOwnProfile ? ownFollowers.length : (viewingUser?.followers || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </button>
              <button className="text-center">
                <p className="text-xl font-bold text-foreground">
                  {isOwnProfile ? 12 : (viewingUser?.following || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Following</p>
              </button>
            </div>
          </div>

          {/* Name and Handle */}
          <div className="mb-3">
            <h2 className="text-lg font-bold text-foreground">{profileName}</h2>
            <p className="text-sm text-muted-foreground">{profileHandle}</p>
          </div>

          {/* Rank Badge - Bigger */}
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-volt/20 px-3 py-1.5 rounded-full">
              <span className="text-volt font-bold text-lg uppercase tracking-wide">{RANK_NAMES[currentRank]}</span>
            </div>
            <span className="text-sm text-muted-foreground">{totalXP.toLocaleString()} XP</span>
          </div>

          {/* Total Workout Time */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Clock className="w-4 h-4" />
            <span>
              {isOwnProfile 
                ? formatDuration((user?.workoutsCompleted || 24) * 1800) // Estimate ~30min per workout
                : formatDuration(viewingUser?.totalWorkoutTime || 0)
              } total training
            </span>
          </div>

          {/* XP Bar */}
          <XPBar currentXP={totalXP} className="mb-4" />

          {/* Bio (for other profiles) */}
          {!isOwnProfile && viewingUser?.bio && (
            <p className="text-sm text-foreground mb-3">{viewingUser.bio}</p>
          )}

          {/* Location */}
          {!isOwnProfile && viewingUser?.location && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
              <MapPin className="w-3 h-3" />
              <span>{viewingUser.location}</span>
            </div>
          )}

          {/* Action Buttons */}
          {isOwnProfile ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 bg-surface-1 border-surface-3">
                Edit Profile
              </Button>
              <Button variant="outline" className="bg-surface-1 border-surface-3">
                <LinkIcon className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button 
                onClick={() => handleFollow(userId!)}
                className={cn(
                  "flex-1",
                  followingState[userId!] 
                    ? "bg-surface-1 border border-surface-3 text-foreground hover:bg-surface-2" 
                    : "bg-volt text-primary-foreground hover:bg-volt/90"
                )}
              >
                {followingState[userId!] ? (
                  <>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Follow
                  </>
                )}
              </Button>
              <Button variant="outline" className="bg-surface-1 border-surface-3">
                Message
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 px-4 mb-4">
          <div className="card-workout text-center py-3">
            <Flame className="w-5 h-5 text-volt mx-auto mb-1" />
            <p className="text-xl font-bold text-volt">
              {isOwnProfile ? (user?.currentStreak || 3) : (viewingUser?.currentStreak || 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">Day Streak</p>
          </div>
          <div className="card-workout text-center py-3">
            <Trophy className="w-5 h-5 text-volt mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">
              {isOwnProfile ? (user?.longestStreak || 14) : (viewingUser?.longestStreak || 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">Best Streak</p>
          </div>
          <div className="card-workout text-center py-3">
            <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">
              {isOwnProfile 
                ? Math.floor((user?.workoutsCompleted || 24) * 30 / 60) 
                : Math.floor((viewingUser?.totalWorkoutTime || 0) / 3600)
              }h
            </p>
            <p className="text-[10px] text-muted-foreground">Total Time</p>
          </div>
        </div>

        {/* Followers Preview (own profile only) */}
        {isOwnProfile && ownFollowers.length > 0 && (
          <div className="px-4 mb-4">
            <div className="card-workout">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Followers</h3>
                <button className="text-sm text-volt">See All</button>
              </div>
              <div className="space-y-2">
                {ownFollowers.slice(0, 3).map((follower) => (
                  <button
                    key={follower.id}
                    onClick={() => navigate(`/profile/${follower.id}`)}
                    className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-lg">
                      {follower.avatar}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground">{follower.name}</p>
                      <p className="text-xs text-muted-foreground">{follower.handle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-t border-surface-3">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors',
                    activeTab === tab.id 
                      ? 'border-volt text-volt' 
                      : 'border-transparent text-muted-foreground'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 py-4">
          {activeTab === 'posts' && (
            <div className="space-y-3">
              {!isOwnProfile && viewingUser?.posts ? (
                viewingUser.posts.map((post: any) => (
                  <div key={post.id} className="card-workout">
                    {post.type === 'workout' && (
                      <>
                        <p className="text-sm text-foreground">
                          Completed <span className="font-semibold">{post.name}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-volt text-sm font-bold">+{post.xp} XP</span>
                          <span className="text-xs text-muted-foreground">{post.date}</span>
                        </div>
                      </>
                    )}
                    {post.type === 'rank_up' && (
                      <>
                        <p className="text-sm text-foreground">
                          Ranked up to <span className="font-bold text-volt">{post.rank}</span>! 🏆
                        </p>
                        <span className="text-xs text-muted-foreground">{post.date}</span>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Grid3X3 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No posts yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'workouts' && (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Workout history coming soon</p>
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="text-center py-8">
              <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No saved items</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
