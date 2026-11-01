import { GloveArt } from '@/components/ui/GameArt';
import { useEffect, useState } from 'react';
import { Settings, User, Link as LinkIcon, UserPlus, UserCheck, Clock, Trophy, Flame, ChevronRight, X, Search, Check, Share2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useUserSearch } from '@/hooks/useUserSearch';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/hooks/useProfile';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useFollows } from '@/hooks/useFollows';
import { useAuth } from '@/contexts/useAuth';
import { XPBar } from '@/components/ui/XPBar';
import { PrestigeBadge } from '@/components/ui/PrestigeDisplay';
import { Prestige, getRankingFromLevel, isPrestigeEligible } from '@/lib/xpSystem';
import { PrestigeAvailableBanner, PrestigePrompt } from '@/components/workout/PrestigePrompt';
import { LevelUpOverlay } from '@/components/ui/LevelUpOverlay';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { promptEmailLink } from '@/lib/guest';
import { toast } from 'sonner';
import { BadgeCollection } from '@/components/BadgeCollection';
import { SharedWorkoutsModal } from '@/components/SharedWorkoutsModal';
import { useGloves } from '@/hooks/useGloves';
import { GLOVES } from '@/data/gloves';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

type ListModalType = 'followers' | 'following' | 'search' | null;

const Profile = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { profile, updateProfile } = useProfile();
  const { user: authUser, isGuest } = useAuth();
  const { data: publicProfile, isLoading: isLoadingPublic } = usePublicProfile(userId);
  const { followersCount, followingCount, followersList, followingList, isFollowing, follow, unfollow } = useFollows(userId);
  const [listModal, setListModal] = useState<ListModalType>(null);
  const [showSharedWorkouts, setShowSharedWorkouts] = useState(false);
  const { history } = useWorkoutHistory();
  const [showPrestigePrompt, setShowPrestigePrompt] = useState(false);
  const [showLevelUpOverlay, setShowLevelUpOverlay] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { isAdmin } = useUserRole();
  const { equippedGlove, unlockedGloves } = useGloves();
  const { results: searchResults, isLoading: isSearching, hasQuery } = useUserSearch(searchQuery);

  // Other fighters' profiles are only readable with an account
  useEffect(() => {
    if (isGuest && userId) {
      promptEmailLink("view other fighters' profiles");
      navigate('/profile', { replace: true });
    }
  }, [isGuest, userId, navigate]);

  // Determine if viewing own profile or someone else's
  const isOwnProfile = !userId || userId === authUser?.id;
  const viewingUser = isOwnProfile ? null : publicProfile;

  // Get prestige and ranking data - use real data from database for both own and other profiles
  const prestige: Prestige = isOwnProfile 
    ? (profile?.prestige || 'beginner') 
    : (viewingUser?.prestige || 'beginner');
  const currentLevel = isOwnProfile ? (profile?.current_level || 1) : (viewingUser?.current_level || 1);
  const ranking = getRankingFromLevel(currentLevel);

  // Use real user data from database for both own and other profiles
  const totalXP = isOwnProfile ? (profile?.total_xp || 0) : (viewingUser?.total_xp || 0);
  const profileName = isOwnProfile ? (profile?.name || 'Fighter') : (viewingUser?.name || 'Fighter');
  const profileHandle = isOwnProfile 
    ? '@' + (profile?.handle || profile?.name?.toLowerCase().replace(/\s+/g, '') || 'fighter') 
    : '@' + (viewingUser?.handle || viewingUser?.name?.toLowerCase().replace(/\s+/g, '') || 'fighter');
  const profileAvatar = isOwnProfile ? profile?.avatar_url : viewingUser?.avatar_url;
  // Your own log counts too, since a guest's profile row doesn't track these
  const workoutsCompleted = isOwnProfile ? Math.max(profile?.workouts_completed || 0, history.length) : (viewingUser?.workouts_completed || 0);
  const currentStreak = isOwnProfile ? (profile?.current_streak || 0) : (viewingUser?.current_streak || 0);
  const longestStreak = isOwnProfile ? (profile?.longest_streak || 0) : currentStreak; // Public profiles don't expose longest_streak
  const totalTrainingSeconds = isOwnProfile
    ? Math.max(profile?.total_training_seconds || 0, history.reduce((total, entry) => total + (entry.duration || 0), 0))
    : (viewingUser?.total_training_seconds || 0);
  const bio = isOwnProfile ? profile?.bio : viewingUser?.bio;
  const profileRole = isOwnProfile ? (profile?.role || 'fighter') : (viewingUser?.role || 'fighter');

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
    if (isGuest) {
      promptEmailLink('find other fighters');
      return;
    }
    setSearchQuery('');
    setListModal('search');
  };

  const prestigeEligible = isOwnProfile && isPrestigeEligible(prestige, totalXP);

  const handlePrestige = () => {
    const order: Prestige[] = ['rookie', 'beginner', 'intermediate', 'advanced', 'pro'];
    const idx = order.indexOf(prestige);
    const next = idx < order.length - 1 ? order[idx + 1] : null;
    if (!next) return;
    updateProfile.mutate({
      prestige: next,
      current_level: 1,
      total_xp: 0,
      experience_level: next,
    });
    setShowPrestigePrompt(false);
  };

  if (showPrestigePrompt) {
    return (
      <AppLayout>
        <PrestigePrompt
          currentPrestige={prestige}
          onPrestige={handlePrestige}
          onDefer={() => setShowPrestigePrompt(false)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 safe-top border-b border-surface-3">
          <h1 className="text-xl font-bold text-foreground">Profile</h1>
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
            {/* Avatar + Name */}
            <div className="shrink-0 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-volt/20 flex items-center justify-center">
                {profileAvatar ? (
                  profileAvatar.startsWith('http') ? (
                    <img src={profileAvatar} alt={profileName} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <span className="text-3xl">{profileAvatar}</span>
                  )
                ) : (
                  <User className="w-8 h-8 text-volt" />
                )}
              </div>
              <h2 className="text-sm font-bold text-foreground mt-1.5 text-center max-w-[120px] truncate">{profileName}</h2>
            </div>

            {/* Stats + Action Buttons */}
            <div className="flex-1 space-y-3">
              <div className="flex justify-around">
                <button onClick={() => navigate('/history')} className="text-center">
                  <p className="text-xl font-bold text-foreground">
                    {workoutsCompleted}
                  </p>
                  <p className="text-xs text-muted-foreground">Workouts</p>
                </button>
                <button onClick={() => setListModal('followers')} className="text-center">
                  <p className="text-xl font-bold text-foreground">{followersCount}</p>
                  <p className="text-xs text-muted-foreground">Followers</p>
                </button>
                <button onClick={() => setListModal('following')} className="text-center">
                  <p className="text-xl font-bold text-foreground">{followingCount}</p>
                  <p className="text-xs text-muted-foreground">Following</p>
                </button>
              </div>

              {/* Action Buttons */}
              {isOwnProfile ? (
                <div className="flex gap-2">
                  <Button 
                    onClick={() => navigate('/edit-profile')}
                    variant="outline" 
                    size="sm"
                    className="flex-1 bg-surface-1 border-surface-3"
                  >
                    Edit Profile
                  </Button>
                  <Button 
                    onClick={() => {
                      if (isGuest) {
                        promptEmailLink('share your profile');
                        return;
                      }
                      navigator.clipboard.writeText(window.location.href);
                      toast.success('Profile link copied!');
                    }}
                    variant="outline" 
                    size="sm"
                    className="bg-surface-1 border-surface-3"
                  >
                    <LinkIcon className="w-4 h-4" />
                  </Button>
                  <Button 
                    onClick={handleOpenSearch}
                    variant="outline" 
                    size="sm"
                    className="bg-surface-1 border-surface-3"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleFollow(userId!)}
                    disabled={follow.isPending || unfollow.isPending}
                    size="sm"
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
                </div>
              )}
            </div>
          </div>

          <div className="border-b border-surface-3 mb-4" />

          {/* Name and Handle */}
          <div className="mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase text-volt">
                {profileRole === 'coach' ? 'Coach' : 'Fighter'}
              </span>
              {isOwnProfile && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <button onClick={() => navigate('/gloves')} className="flex items-center gap-1.5 group">
                    <GloveArt id={(GLOVES[equippedGlove] || GLOVES.default).id} className="w-4 h-4 rounded-sm ring-1 ring-volt/40" />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      {(GLOVES[equippedGlove] || GLOVES.default).name}
                    </span>
                  </button>
                </>
              )}
              <span className="text-muted-foreground/50">•</span>
              <p className="text-sm text-muted-foreground">{profileHandle}</p>
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

          {/* Glove Counter */}
          {isOwnProfile && (
            <button
              onClick={() => navigate('/gloves')}
              className="flex items-center gap-2 mb-3 group"
            >
              <span className="text-xs text-muted-foreground/60">
                {unlockedGloves.length}/52 Gloves
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
            </button>
          )}
          {/* Total Workout Time */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Clock className="w-4 h-4" />
            <span>
              {formatDuration(totalTrainingSeconds)} total training
            </span>
          </div>

          {/* Bio */}
          {bio && (
            <p className="text-sm text-foreground mb-3">{bio}</p>
          )}

          {/* Shared Workouts Button */}
          {isOwnProfile && (
            <Button 
              onClick={() => setShowSharedWorkouts(true)}
              variant="outline" 
              className="w-full bg-surface-1 border-surface-3"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Shared Workouts
            </Button>
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
              {formatDuration(totalTrainingSeconds)}
            </p>
            <p className="text-[10px] text-muted-foreground">Total Time</p>
          </div>
        </div>

        {/* Prestige Available Banner */}
        {prestigeEligible && (
          <div className="px-4 mb-4">
            <PrestigeAvailableBanner 
              currentPrestige={prestige} 
              onClick={() => setShowPrestigePrompt(true)} 
            />
          </div>
        )}


        {/* Badge Collection */}
        {isOwnProfile && (
          <div className="px-4 mb-6">
            <BadgeCollection />
          </div>
        )}

        {/* Level Up Overlay (admin test) */}
        {showLevelUpOverlay && (
          <LevelUpOverlay level={currentLevel} onComplete={() => setShowLevelUpOverlay(false)} />
        )}


      </div>

      {/* Followers/Following Modal */}
      {listModal && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setListModal(null)}
          />
           <div className="relative w-full max-w-md mx-4 bg-surface-1 rounded-2xl border border-surface-3 max-h-[70vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3">
              <button 
                onClick={() => setListModal(null)}
                className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center hover:bg-surface-3 transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
              <h2 className="text-sm font-semibold text-foreground capitalize">
                {listModal === 'search' ? 'Find People' : listModal}
              </h2>
              <button 
                onClick={() => setListModal(null)}
                className="w-8 h-8 rounded-full bg-volt/20 flex items-center justify-center hover:bg-volt/30 transition-colors"
              >
                <Check className="w-4 h-4 text-volt" />
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
                      <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-xl overflow-hidden">
                        {person.avatar ? (
                          person.avatar.startsWith('http') ? (
                            <img src={person.avatar} alt={person.name} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <span>{person.avatar}</span>
                          )
                        ) : '👤'}
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

      {/* Shared Workouts Modal */}
      {showSharedWorkouts && (
        <SharedWorkoutsModal onClose={() => setShowSharedWorkouts(false)} />
      )}
    </AppLayout>
  );
};

export default Profile;
