import { useLocation, useNavigate } from 'react-router-dom';
import { Plate } from '@/components/broadcast/Plate';
import { Ticker } from '@/components/broadcast/Ticker';
import { useProfile } from '@/hooks/useProfile';
import { getRankingFromLevel, getXPWithinCurrentLevel, RANKING_NAMES, RANKING_ORDER } from '@/lib/xpSystem';

const channels = [
  { label: 'HOME', path: '/' },
  { label: 'MY STATS', path: '/stats' },
  { label: 'FIGHT CLUB', path: '/fight-club' },
  { label: 'PROFILE', path: '/profile' },
];

/** The ticker carries your real numbers, and only once there's a profile to read them from. */
function useTickerItems() {
  const { profile } = useProfile();
  if (!profile) return [];
  const level = profile.current_level || 1;
  const rank = getRankingFromLevel(level);
  const within = getXPWithinCurrentLevel(profile.prestige, profile.total_xp || 0);
  const nextRank = RANKING_ORDER[RANKING_ORDER.indexOf(rank) + 1];
  return [
    level < 100
      ? `${RANKING_NAMES[rank]}, Lvl ${level}, ${Math.max(0, Math.ceil(within.required - within.current)).toLocaleString()} XP to Lvl ${level + 1}`
      : `${RANKING_NAMES[rank]}, Lvl ${level}`,
    profile.current_streak > 0 && `Streak ${profile.current_streak}`,
    `Workouts ${profile.workouts_completed || 0}`,
    nextRank && `${RANKING_NAMES[nextRank]} at Lvl ${RANKING_ORDER.indexOf(nextRank) * 10 + 1}`,
  ];
}

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const items = useTickerItems();

  return (
    <div className="app-footer">
      <div className="app-footer-inner">
        <Ticker items={items} />
        <nav className="channel-strip fx" aria-label="Main">
          {channels.map((channel) => (
            <Plate
              as="button"
              key={channel.path}
              tone="clear"
              onClick={() => navigate(channel.path)}
              aria-current={location.pathname === channel.path ? 'page' : undefined}
            >
              {channel.label}
            </Plate>
          ))}
        </nav>
      </div>
    </div>
  );
}
