import { useState } from 'react';
import { ArrowLeft, Settings, User, MapPin, Link as LinkIcon, UserPlus, UserCheck, Clock, Trophy, Flame, ChevronRight, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useUserSearch } from '@/hooks/useUserSearch';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useProfile, getProfileRanking } from '@/hooks/useProfile';
import { useFollows } from '@/hooks/useFollows';
import { useAuth } from '@/contexts/AuthContext';
import { XPBar } from '@/components/ui/XPBar';
import { PrestigeDisplay, PrestigeBadge } from '@/components/ui/PrestigeDisplay';
import { Prestige, PRESTIGE_NAMES, RANKING_NAMES, getRankingFromLevel } from '@/lib/xpSystem';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Mock data for other users (when viewing someone else's profile)
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
    totalWorkoutTime: 280800,
    followers: 1245,
    following: 89,
    isFollowing: false,
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
    totalWorkoutTime: 842400,
    followers: 5680,
    following: 156,
    isFollowing: true,
  },
  'alex-rodriguez': {
    id: 'alex-rodriguez',
    name: 'Alex Rodriguez',
    handle: '@alexfists',
    avatar: '🧔',
    bio: 'Amateur boxer | Training 5 days a week',
    location: 'Miami, FL',
    totalXP: 15000,
    workoutsCompleted: 78,
    currentStreak: 5,
    longestStreak: 21,
    totalWorkoutTime: 140400,
    followers: 342,
    following: 67,
    isFollowing: false,
  },
  'jamie-lee': {
    id: 'jamie-lee',
    name: 'Jamie Lee',
    handle: '@jamiepunches',
    avatar: '👧',
    bio: 'Fitness coach | Boxing for cardio',
    location: 'Chicago, IL',
    totalXP: 22000,
    workoutsCompleted: 112,
    currentStreak: 8,
    longestStreak: 35,
    totalWorkoutTime: 201600,
    followers: 890,
    following: 134,
    isFollowing: true,
  },
};

type ListModalType = 'followers' | 'following' | 'search' | null;

const Profile = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { profile } = useProfile();
  const { user: authUser } = useAuth();
  const { followersCount, followingCount, followersList, followingList, isFollowing, follow, unfollow } = useFollows(userId);
  const [listModal, setListModal] = useState<ListModalType>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { results: searchResults, isLoading: isSearching, hasQuery } = useUserSearch(searchQuery);

  // Determine if viewing own profile or someone else's
  const isOwnProfile = !userId;
  const viewingUser = isOwnProfile ? null : MOCK_USERS[userId];

  // Get prestige and ranking data
  const prestige: Prestige = isOwnProfile 
    ? (profile?.prestige || 'beginner') 
    : 'beginner';
  const currentLevel = isOwnProfile ? (profile?.current_level || 1) : 1;
  const ranking = getRankingFromLevel(currentLevel);

  // Use real user data from database
  const totalXP = isOwnProfile ? (profile?.total_xp || 0) : (viewingUser?.totalXP || 0);
  const profileName = isOwnProfile ? (profile?.name || 'Fighter') : (viewingUser?.name || 'Unknown');
  const profileHandle = isOwnProfile 
    ? '@' + (profile?.handle || profile?.name?.toLowerCase().replace(/\s+/g, '') || 'fighter') 
    : (viewingUser?.handle || '@unknown');
  const profileAvatar = isOwnProfile ? profile?.avatar_url : viewingUser?.avatar;
  const workoutsCompleted = isOwnProfile ? (profile?.workouts_completed || 0) : (viewingUser?.workoutsCompleted || 0);
  const currentStreak = isOwnProfile ? (profile?.current_streak || 0) : (viewingUser?.currentStreak || 0);
  const longestStreak = isOwnProfile ? (profile?.longest_streak || 0) : (viewingUser?.longestStreak || 0);

  const handleFollow = (id: string) => {
    if (isFollowing) {
      unfollow.mutate(id);
    } else {
      follow.mutate(id);
    }
  };

  const getListData = () => {
    if (listModal === 'followers') {
      return followersList;
    }
    if (listModal === 'following') {
      return followingList;
    }
    if (listModal === 'search') {
      return searchResults.map(r => ({
        id: r.user_id,
        name: r.name,
        handle: r.handle ? `@${r.handle}` : `@${r.name.toLowerCase().replace(/\s+/g, '')}`,
        avatar: r.avatar_url,
      }));
    }
    return [];
  };

  const handleOpenSearch = () => {
    setSearchQuery('');
    setListModal('search');
  };

  return (
    <AppLayout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 safe-top border-b border-surface-3">
          <h1 className="text-xl font-bold text-foreground">{profileName}</h1>
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
                  {workoutsCompleted}
                </p>
                <p className="text-xs text-muted-foreground">Workouts</p>
              </div>
              <button 
                onClick={() => setListModal('followers')}
                className="text-center hover:opacity-80 transition-opacity"
              >
                <p className="text-xl font-bold text-foreground">{followersCount}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </button>
              <button 
                onClick={() => setListModal('following')}
                className="text-center hover:opacity-80 transition-opacity"
              >
                <p className="text-xl font-bold text-foreground">{followingCount}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </button>
            </div>
          </div>

          {/* Name and Handle */}
          <div className="mb-3">
            <h2 className="text-lg font-bold text-foreground">{profileName}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground">{profileHandle}</p>
              {isOwnProfile && authUser?.email && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <p className="text-sm text-muted-foreground">{authUser.email}</p>
                </>
              )}
            </div>
          </div>

          {/* Prestige/Ranking/Level Display */}
          <div className="mb-3">
            <PrestigeBadge 
              prestige={prestige} 
              ranking={ranking} 
              level={currentLevel} 
            />
            <span className="text-sm text-muted-foreground ml-2">{totalXP.toLocaleString()} XP</span>
          </div>

          {/* Total Workout Time */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Clock className="w-4 h-4" />
            <span>
              {isOwnProfile 
                ? formatDuration(workoutsCompleted * 1800)
                : formatDuration(viewingUser?.totalWorkoutTime || 0)
              } total training
            </span>
          </div>

          {/* XP Bar */}
          <XPBar 
            prestige={prestige}
            level={currentLevel}
            totalXP={totalXP}
            className="mb-4" 
          />

          {/* Bio */}
          {isOwnProfile && profile?.bio && (
            <p className="text-sm text-foreground mb-3">{profile.bio}</p>
          )}
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
              <Button 
                onClick={() => navigate('/edit-profile')}
                variant="outline" 
                className="flex-1 bg-surface-1 border-surface-3"
              >
                Edit Profile
              </Button>
              <Button 
                onClick={handleOpenSearch}
                variant="outline" 
                className="bg-surface-1 border-surface-3"
              >
                <Search className="w-4 h-4" />
              </Button>
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Profile link copied!');
                }}
                variant="outline" 
                className="bg-surface-1 border-surface-3"
              >
                <LinkIcon className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button 
                onClick={() => handleFollow(userId!)}
                disabled={follow.isPending || unfollow.isPending}
                className={cn(
                  "flex-1",
                  isFollowing 
                    ? "bg-surface-1 border border-surface-3 text-foreground hover:bg-surface-2" 
                    : "bg-volt text-primary-foreground hover:bg-volt/90"
                )}
              >
                {isFollowing ? (
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
            <Flame className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold text-volt">
              {currentStreak}
            </p>
            <p className="text-[10px] text-muted-foreground">Day Streak</p>
          </div>
          <div className="card-workout text-center py-3">
            <Trophy className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold text-volt">
              {longestStreak}
            </p>
            <p className="text-[10px] text-muted-foreground">Best Streak</p>
          </div>
          <div className="card-workout text-center py-3">
            <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold text-volt">
              {isOwnProfile 
                ? Math.floor(workoutsCompleted * 30 / 60) 
                : Math.floor((viewingUser?.totalWorkoutTime || 0) / 3600)
              }h
            </p>
            <p className="text-[10px] text-muted-foreground">Total Time</p>
          </div>
        </div>

        {/* Followers Preview (own profile only) */}
        {isOwnProfile && followersList.length > 0 && (
          <div className="px-4 mb-4">
            <div className="card-workout">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Followers</h3>
                <button 
                  onClick={() => setListModal('followers')}
                  className="text-sm text-volt hover:underline"
                >
                  See All
                </button>
              </div>
              <div className="space-y-2">
                {followersList.slice(0, 3).map((follower) => (
                  <button
                    key={follower.id}
                    onClick={() => navigate(`/profile/${follower.id}`)}
                    className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-lg">
                      {follower.avatar || '👤'}
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

        {/* Following Preview (own profile only) */}
        {isOwnProfile && followingList.length > 0 && (
          <div className="px-4 mb-4">
            <div className="card-workout">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Following</h3>
                <button 
                  onClick={() => setListModal('following')}
                  className="text-sm text-volt hover:underline"
                >
                  See All
                </button>
              </div>
              <div className="space-y-2">
                {followingList.slice(0, 3).map((person) => (
                  <button
                    key={person.id}
                    onClick={() => navigate(`/profile/${person.id}`)}
                    className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-lg">
                      {person.avatar || '👤'}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground">{person.name}</p>
                      <p className="text-xs text-muted-foreground">{person.handle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Followers/Following Modal */}
      {listModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setListModal(null)}
          />
          <div className="relative w-full max-w-md bg-surface-1 rounded-t-2xl border-t border-surface-3 max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-surface-3">
              <h2 className="text-lg font-bold text-foreground capitalize">
                {listModal === 'search' ? 'Find People' : listModal}
              </h2>
              <button 
                onClick={() => setListModal(null)}
                className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input (only for search mode) */}
            {listModal === 'search' && (
              <div className="px-4 pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or @handle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-surface-2 border-surface-3"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {listModal === 'search' && !hasQuery ? (
                <p className="text-center text-muted-foreground py-8">
                  Type at least 2 characters to search
                </p>
              ) : listModal === 'search' && isSearching ? (
                <p className="text-center text-muted-foreground py-8">
                  Searching...
                </p>
              ) : getListData().length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {listModal === 'search' ? 'No users found' : `No ${listModal} yet`}
                </p>
              ) : (
                <div className="space-y-2">
                  {getListData().map((person) => (
                    <button
                      key={person.id}
                      onClick={() => {
                        setListModal(null);
                        navigate(`/profile/${person.id}`);
                      }}
                      className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-xl">
                        {person.avatar || '👤'}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-foreground">{person.name}</p>
                        <p className="text-sm text-muted-foreground">{person.handle}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setListModal(null);
                          navigate(`/profile/${person.id}`);
                        }}
                        className="bg-surface-2 text-foreground hover:bg-surface-3"
                      >
                        View
                      </Button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Profile;
