import { GloveArt } from '@/components/ui/GameArt';
import { useEffect, useState } from 'react';
import { Settings, Link as LinkIcon, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useUserSearch } from '@/hooks/useUserSearch';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { BroadcastPage, EmptyPlate, FitText, Plate, SectionRule } from '@/components/broadcast';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { useProfile } from '@/hooks/useProfile';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useFollows } from '@/hooks/useFollows';
import { useAuth } from '@/contexts/useAuth';
import { XPBar } from '@/components/ui/XPBar';
import { PRESTIGE_NAMES, Prestige, RANKING_NAMES, getRankingFromLevel, isPrestigeEligible } from '@/lib/xpSystem';
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

// A big three-across stat, like the numbers under a lower third
function StatTile({ value, label, lime }: { value: string | number; label: string; lime?: boolean }) {
  return (
    <>
      <p className={cn('fx text-[2.625rem]', lime && 'text-volt')}>{value}</p>
      <p className="lab mt-0.5">{label}</p>
    </>
  );
}

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

  // A link to you, not to the /profile page, which shows whoever opens it their own profile
  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${authUser?.id}`);
      toast.success('Profile link copied!');
    } catch {
      toast.error("Couldn't copy the link");
    }
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

  if (!isOwnProfile && !isGuest && !isLoadingPublic && !publicProfile) {
    return (
      <AppLayout>
        <BroadcastPage show="Profile">
          <EmptyPlate title="Fighter not found" body="This link doesn't match anyone on Clocked.">
            <Button onClick={() => navigate('/fight-club')} variant="secondary">
              Back to Fight Club
            </Button>
          </EmptyPlate>
        </BroadcastPage>
      </AppLayout>
    );
  }

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

  const equippedGloveData = GLOVES[equippedGlove] || GLOVES.default;
  const photo = profileAvatar?.startsWith('http') ? profileAvatar : null;
  const isCompactName = profileName.length > 12;
  // What you've earned, then the next ones to chase, five across
  const nextGloves = Object.values(GLOVES)
    .filter((glove) => !unlockedGloves.includes(glove.id) && glove.id !== 'bmf')
    .sort((a, b) => a.level - b.level)
    .slice(0, 5 - Math.min(3, unlockedGloves.length));

  return (
    <AppLayout>
      <BroadcastPage
        show="Profile"
        air={isOwnProfile && (
          <button type="button" onClick={() => navigate('/settings')} aria-label="Settings" className="plate plate-graphite h-11 w-12">
            <Settings className="size-5" />
          </button>
        )}
      >
        {/* The graphic that comes up when a fighter walks out */}
        <section className="relative mt-2 overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-[60%] bg-[#0a0a0a] [clip-path:polygon(3.25rem_0,100%_0,100%_100%,0_100%)]">
            {photo ? (
              <img src={photo} alt={profileName} className="h-full w-full object-cover" />
            ) : (
              <GloveArt id={equippedGloveData.id} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="relative pb-3 pt-2">
            <Plate tone="lime" bleed="left" className="h-[1.875rem] justify-start pl-4 pr-6 text-[1.375rem]">Fighter profile</Plate>
            <h2 className="px-4 pt-2">
              <FitText max={144} className={cn('fx', isCompactName ? 'h-14' : 'h-[clamp(5.5rem,27vw,9rem)]')}>{profileName}</FitText>
            </h2>
            <p className="lab lab-w mt-1 max-w-[62%] truncate px-4 text-[0.9375rem]">{profileHandle}</p>
            <Plate tone="white" bleed="left" className="mt-2 h-10 justify-start pl-4 pr-7 text-[2.125rem]">
              {profileRole === 'coach' ? 'Coach' : 'Fighter'}
            </Plate>
            {!photo && profileAvatar && <span className="ml-4 align-middle text-3xl">{profileAvatar}</span>}
          </div>
        </section>

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 pb-2">
          <p className="fx whitespace-nowrap text-[2rem]">
            {PRESTIGE_NAMES[prestige]} {RANKING_NAMES[ranking]} <span className="text-volt">Lvl {currentLevel}</span>
          </p>
          <p className="fx whitespace-nowrap text-[2rem]">{totalXP.toLocaleString()} XP</p>
        </div>

        {isOwnProfile && (
          <div className="px-4 pb-3">
            <XPBar prestige={prestige} level={currentLevel} totalXP={totalXP} showRank={false} />
          </div>
        )}

        <div className="grid grid-cols-3 border-y border-surface-3 text-center">
          <button type="button" onClick={() => navigate('/history')} className="py-1.5 transition-colors hover:bg-surface-1">
            <StatTile value={workoutsCompleted} label="Workouts" />
          </button>
          <button type="button" onClick={() => isOwnProfile && setListModal('followers')} className="py-1.5 transition-colors hover:bg-surface-1">
            <StatTile value={followersCount} label="Followers" />
          </button>
          <button type="button" onClick={() => isOwnProfile && setListModal('following')} className="py-1.5 transition-colors hover:bg-surface-1">
            <StatTile value={followingCount} label="Following" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 px-5 py-3">
          {isOwnProfile ? (
            <>
              <Button onClick={() => navigate('/edit-profile')} variant="steel" size="sm" className="flex-1">
                Edit Profile
              </Button>
              <Button
                onClick={() => {
                  if (isGuest) {
                    promptEmailLink('share your profile');
                    return;
                  }
                  copyProfileLink();
                }}
                variant="secondary"
                size="icon"
                aria-label="Copy profile link"
              >
                <LinkIcon />
              </Button>
              <Button onClick={handleOpenSearch} variant="secondary" size="icon" aria-label="Find people">
                <Search />
              </Button>
            </>
          ) : (
            <Button
              onClick={() => handleFollow(userId!)}
              disabled={follow.isPending || unfollow.isPending}
              variant={isFollowing ? 'steel' : 'default'}
              className="flex-1"
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 border-y border-surface-2 py-1.5 text-center">
          <div><StatTile value={currentStreak} label="Day Streak" lime /></div>
          <div><StatTile value={longestStreak} label="Best Streak" /></div>
          <div><StatTile value={formatDuration(totalTrainingSeconds)} label="Total Time" /></div>
        </div>

        <div className="space-y-2 px-4 pt-3">
          <p className="lab lab-w">{formatDuration(totalTrainingSeconds)} total training</p>
          {bio && <p className="prose-w text-lg">{bio}</p>}
        </div>

        {isOwnProfile && (
          <div className="px-5 pt-3">
            <Button onClick={() => setShowSharedWorkouts(true)} variant="secondary" className="w-full">
              Shared Workouts
            </Button>
          </div>
        )}

        {prestigeEligible && (
          <div className="px-4 pt-3">
            <PrestigeAvailableBanner
              currentPrestige={prestige}
              onClick={() => setShowPrestigePrompt(true)}
            />
          </div>
        )}

        {/* Gloves */}
        {isOwnProfile && (
          <section className="pt-2">
            <SectionRule title={equippedGloveData.name} right={`${unlockedGloves.length}/52 Gloves`} />
            <button
              type="button"
              onClick={() => navigate('/gloves')}
              aria-label={`Gloves, ${unlockedGloves.length} of 52 unlocked`}
              className="grid w-full grid-cols-5 gap-2 px-4 py-2.5 transition-colors hover:bg-surface-1"
            >
              {[...unlockedGloves.slice(-3).map((id) => ({ id, off: false })), ...nextGloves.map(({ id }) => ({ id, off: true }))].map(({ id, off }) => (
                <span
                  key={id}
                  className={cn(
                    'art-slant block aspect-square [clip-path:polygon(24.9%_0,100%_0,75.1%_100%,0_100%)]',
                    id === equippedGlove && '!bg-volt',
                  )}
                >
                  <GloveArt id={id} className={cn('h-full w-full', off && 'art-off', id === equippedGlove && 'mix-blend-multiply')} />
                </span>
              ))}
            </button>
          </section>
        )}

        {/* Badge Collection */}
        {isOwnProfile && (
          <div className="pb-6 pt-4">
            <BadgeCollection />
          </div>
        )}

        {/* Level Up Overlay (admin test) */}
        {showLevelUpOverlay && (
          <LevelUpOverlay level={currentLevel} onComplete={() => setShowLevelUpOverlay(false)} />
        )}
      </BroadcastPage>

      {/* Followers/Following Modal */}
      {listModal && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={listModal === 'search' ? 'Find People' : listModal}>
          <div className="absolute inset-0 bg-background/80" onClick={() => setListModal(null)} />
          <div className="dialog-panel flex flex-col">
            <div className="flex items-center justify-between gap-3 pb-2">
              <h2 className="fx text-4xl">{listModal === 'search' ? 'Find People' : listModal}</h2>
              <Button onClick={() => setListModal(null)} variant="secondary" size="sm">Close</Button>
            </div>

            {/* Search Input (only for search mode) */}
            {listModal === 'search' && (
              <Input
                placeholder="Search by name or @handle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            )}

            {/* Modal Content */}
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              {listModal === 'search' && !hasQuery ? (
                <p className="prose-w py-6 text-lg">Type at least 2 characters to search</p>
              ) : listModal === 'search' && isSearching ? (
                <p className="prose-w py-6 text-lg">Searching...</p>
              ) : getListData().length === 0 ? (
                <p className="prose-w py-6 text-lg">
                  {listModal === 'search' ? 'No users found' : `No ${listModal} yet`}
                </p>
              ) : (
                getListData().map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      setListModal(null);
                      navigate(`/profile/${person.id}`);
                    }}
                    className="flex min-h-14 w-full items-center gap-3 border-b border-surface-2 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="art-slant flex size-12 shrink-0 items-center justify-center text-xl [clip-path:polygon(24.9%_0,100%_0,75.1%_100%,0_100%)]">
                      {person.avatar ? (
                        person.avatar.startsWith('http') ? (
                          <img src={person.avatar} alt={person.name} className="h-full w-full object-cover" />
                        ) : (
                          <span>{person.avatar}</span>
                        )
                      ) : (
                        <span className="fx text-2xl text-muted-foreground" aria-hidden="true">{person.name.charAt(0)}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <p className="fx truncate text-2xl">{person.name}</p>
                      <p className="lab mt-0.5 truncate normal-case">{person.handle}</p>
                    </span>
                    <span className={buttonVariants({ variant: 'secondary', size: 'sm' })}>View</span>
                  </button>
                ))
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
