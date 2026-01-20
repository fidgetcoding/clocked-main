import { useState } from 'react';
import { ArrowLeft, Users, Newspaper, Trophy, Search, MessageCircle, BarChart3, Send, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [clubTab, setClubTab] = useState<ClubTab>('feed');
  const [chatMessage, setChatMessage] = useState('');

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'feed', label: 'Feed', icon: Newspaper },
    { id: 'clubs', label: 'Clubs', icon: Users },
    { id: 'presets', label: 'Presets', icon: Trophy },
  ];

  // Mock clubs data
  const myClubs: Club[] = [
    { id: '1', name: 'Iron Fist Boxing', icon: '🥊', type: 'private', coach: 'Mike T.', memberCount: 12, activeNow: 3 },
    { id: '2', name: 'Morning Grinders', icon: '💪', type: 'public', memberCount: 47, activeNow: 8, rank: 3 },
  ];

  const discoverClubs: Club[] = [
    { id: '3', name: 'Global Fighters', icon: '🌍', type: 'public', memberCount: 2400, activeNow: 156 },
  ];

  // Mock feed posts
  const feedPosts = [
    { id: '1', userName: 'Sarah Chen', status: 'live' as const, type: 'currently_training' as const, workoutName: 'Heavy Bag Blast', elapsed: '18:34', avatar: '👩' },
    { id: '2', userName: 'Mike Thompson', status: 'active' as const, type: 'workout_complete' as const, workoutName: '30-Min Blast', xpEarned: 421, message: 'Legs are dead but worth it!', timeAgo: '5 min ago', likes: 12, comments: 3, avatar: '👨' },
    { id: '3', userName: 'James Wilson', status: 'active' as const, type: 'rank_up' as const, newRank: 'SEMI-PRO', timeAgo: '1 hr ago', likes: 89, comments: 12, avatar: '🧔' },
  ];

  // Mock club-specific data
  const clubFeed = [
    { id: '1', userName: 'Coach Mike', avatar: '🧔', message: 'Great session today team! Remember to hydrate.', timeAgo: '2h ago', likes: 8 },
    { id: '2', userName: 'Alex R.', avatar: '👨', message: 'Just hit a new PR on the heavy bag! 💪', timeAgo: '4h ago', likes: 15 },
    { id: '3', userName: 'Sarah C.', avatar: '👩', message: 'Anyone up for a live session tonight?', timeAgo: '6h ago', likes: 4 },
  ];

  const clubChat = [
    { id: '1', userName: 'Coach Mike', avatar: '🧔', message: 'Good morning fighters!', time: '9:00 AM', isOwn: false },
    { id: '2', userName: 'You', avatar: '🥊', message: 'Ready to train!', time: '9:05 AM', isOwn: true },
    { id: '3', userName: 'Alex R.', avatar: '👨', message: 'Let\'s go! Starting my warmup now', time: '9:07 AM', isOwn: false },
  ];

  const clubLeaderboard = [
    { rank: 1, name: 'Coach Mike', xp: 45000, avatar: '🧔', isLive: false },
    { rank: 2, name: 'Sarah C.', xp: 32000, avatar: '👩', isLive: true },
    { rank: 3, name: 'You', xp: 28500, avatar: '🥊', isLive: false, isYou: true },
    { rank: 4, name: 'Alex R.', xp: 25000, avatar: '👨', isLive: false },
    { rank: 5, name: 'Mike T.', xp: 21000, avatar: '👨', isLive: false },
  ];

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
                {clubFeed.map((post) => (
                  <div key={post.id} className="card-workout">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-xl">
                        {post.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{post.userName}</span>
                          <span className="text-xs text-muted-foreground">{post.timeAgo}</span>
                        </div>
                        <p className="text-sm text-foreground mt-1">{post.message}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>❤️ {post.likes}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {clubTab === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
                  {clubChat.map((msg) => (
                    <div key={msg.id} className={cn('flex gap-3', msg.isOwn && 'flex-row-reverse')}>
                      <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-lg flex-shrink-0">
                        {msg.avatar}
                      </div>
                      <div className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-2',
                        msg.isOwn ? 'bg-volt text-primary-foreground' : 'bg-surface-1'
                      )}>
                        {!msg.isOwn && (
                          <p className="text-xs text-muted-foreground mb-1">{msg.userName}</p>
                        )}
                        <p className={cn('text-sm', msg.isOwn ? 'text-primary-foreground' : 'text-foreground')}>
                          {msg.message}
                        </p>
                        <p className={cn('text-xs mt-1', msg.isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="px-4 py-4 border-t border-surface-3 safe-bottom">
                  <div className="flex gap-2">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-surface-1 border-surface-3"
                    />
                    <Button className="bg-volt text-primary-foreground px-4">
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
                          <Button size="sm" className="mt-2 bg-surface-2 hover:bg-surface-3 text-foreground text-xs">
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
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  My Fight Clubs
                </h3>
                <Button size="sm" className="bg-volt text-primary-foreground text-xs">
                  + New
                </Button>
              </div>

              {myClubs.map((club) => (
                <button
                  key={club.id}
                  onClick={() => setSelectedClub(club)}
                  className="card-workout w-full text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-2xl">
                      {club.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{club.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {club.type === 'private' ? 'Private' : 'Public'}
                        {club.coach && ` · Coach: ${club.coach}`}
                        {club.rank && ` · You're #${club.rank} 🔥`}
                      </p>
                      <p className="text-xs text-volt mt-1">{club.activeNow} active now 🟢</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </button>
              ))}

              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-2">
                Discover
              </h3>

              {discoverClubs.map((club) => (
                <button
                  key={club.id}
                  onClick={() => setSelectedClub(club)}
                  className="card-workout w-full text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-2xl">
                      {club.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{club.name}</h4>
                      <p className="text-sm text-muted-foreground">Public · Worldwide ranks</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{club.memberCount.toLocaleString()} 👤</span>
                  </div>
                </button>
              ))}
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