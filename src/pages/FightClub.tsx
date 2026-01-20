import { useState } from 'react';
import { ArrowLeft, Users, Newspaper, Trophy, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tab = 'feed' | 'clubs' | 'presets';

const FightClub = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('feed');

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'feed', label: 'Feed', icon: Newspaper },
    { id: 'clubs', label: 'Clubs', icon: Users },
    { id: 'presets', label: 'Presets', icon: Trophy },
  ];

  // Mock data
  const feedPosts = [
    {
      id: '1',
      userName: 'Sarah Chen',
      status: 'live' as const,
      type: 'currently_training' as const,
      workoutName: 'Heavy Bag Blast',
      elapsed: '18:34',
      avatar: '👩',
    },
    {
      id: '2',
      userName: 'Mike Thompson',
      status: 'active' as const,
      type: 'workout_complete' as const,
      workoutName: '30-Min Blast',
      xpEarned: 421,
      message: 'Legs are dead but worth it!',
      timeAgo: '5 min ago',
      likes: 12,
      comments: 3,
      avatar: '👨',
    },
    {
      id: '3',
      userName: 'James Wilson',
      status: 'active' as const,
      type: 'rank_up' as const,
      newRank: 'SEMI-PRO',
      timeAgo: '1 hr ago',
      likes: 89,
      comments: 12,
      avatar: '🧔',
    },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <header className="px-4 py-4 safe-top border-b border-surface-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-foreground">Fight Club</h1>
            <button className="text-muted-foreground">
              <Search className="w-5 h-5" />
            </button>
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
              {feedPosts.map((post) => (
                <div key={post.id} className="card-workout">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-xl">
                      {post.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{post.userName}</span>
                        {post.status === 'live' && (
                          <span className="flex items-center gap-1 text-xs text-volt font-medium">
                            <span className="status-live" />
                            LIVE
                          </span>
                        )}
                        {post.status === 'active' && (
                          <span className="status-active" />
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
                            <p className="text-sm text-muted-foreground mt-2 italic">
                              "{post.message}"
                            </p>
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
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  My Fight Clubs
                </h3>
                <Button size="sm" className="bg-volt text-primary-foreground text-xs">
                  + New
                </Button>
              </div>

              <div className="card-workout">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-2xl">
                    🥊
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">Iron Fist Boxing</h4>
                    <p className="text-sm text-muted-foreground">Private · Coach: Mike T.</p>
                    <p className="text-xs text-volt mt-1">3 active now 🟢</p>
                  </div>
                  <span className="text-sm text-muted-foreground">12 👤</span>
                </div>
              </div>

              <div className="card-workout">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-2xl">
                    💪
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">Morning Grinders</h4>
                    <p className="text-sm text-muted-foreground">Public · You're #3 🔥</p>
                  </div>
                  <span className="text-sm text-muted-foreground">47 👤</span>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-2">
                Discover
              </h3>

              <div className="card-workout">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-2xl">
                    🌍
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">Global Fighters</h4>
                    <p className="text-sm text-muted-foreground">Public · Worldwide ranks</p>
                  </div>
                  <span className="text-sm text-muted-foreground">2.4K 👤</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search workouts..."
                  className="w-full h-10 pl-9 pr-4 rounded-lg bg-surface-1 border border-surface-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-volt"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                {['All', 'Boxing', 'HIIT', 'Conditioning', 'Beginner'].map((tag) => (
                  <button
                    key={tag}
                    className="px-3 py-1.5 rounded-full bg-surface-1 text-sm text-muted-foreground whitespace-nowrap hover:bg-surface-2"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Trending 🔥
              </h3>

              <div className="card-workout">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-volt/20 flex items-center justify-center text-2xl">
                    🥊
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">30-Min Boxing Blast</h4>
                    <p className="text-sm text-muted-foreground">by @MikeTysonFan</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>⭐ 4.8 (342)</span>
                      <span>📥 12.4K</span>
                      <span>30 min</span>
                      <span className="text-yellow-500">Intermediate</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-workout">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-volt/20 flex items-center justify-center text-2xl">
                    🏃
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">Quick Morning Jabs</h4>
                    <p className="text-sm text-muted-foreground">by @EarlyBirdBoxer</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>⭐ 4.9 (156)</span>
                      <span>📥 8.2K</span>
                      <span>15 min</span>
                      <span className="text-volt">Beginner</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default FightClub;
