import { trustedAvatarUrl } from '@/lib/avatarUrl';

export interface ClubRow {
  id: string;
  name: string;
  icon: string;
  type: 'public' | 'private';
  member_cap: number | null;
}

export interface ClubView {
  id: string;
  name: string;
  icon: string;
  type: 'public' | 'private';
  memberCount: number;
  memberCap: number | null;
  /** Null when the club has no cap. */
  spotsRemaining: number | null;
  isFull: boolean;
}

const toClubView = (club: ClubRow, memberCounts: Record<string, number>): ClubView => {
  const memberCount = memberCounts[club.id] ?? 0;
  const spotsRemaining = club.member_cap === null ? null : Math.max(0, club.member_cap - memberCount);
  return {
    id: club.id,
    name: club.name,
    icon: club.icon,
    type: club.type,
    memberCount,
    memberCap: club.member_cap,
    spotsRemaining,
    isFull: spotsRemaining === 0,
  };
};

/** Your clubs, and the ones you could join. A private club isn't offered, since joining would be refused. */
export function splitClubs(clubs: ClubRow[], myClubIds: string[], memberCounts: Record<string, number>) {
  const views = clubs.map((club) => toClubView(club, memberCounts));
  return {
    mine: views.filter((club) => myClubIds.includes(club.id)),
    discover: views.filter((club) => !myClubIds.includes(club.id) && club.type === 'public'),
  };
}

export const memberLabel = (club: Pick<ClubView, 'memberCount' | 'memberCap'>): string =>
  club.memberCap === null ? `${club.memberCount} members` : `${club.memberCount} / ${club.memberCap} members`;

export interface ClubRankRow {
  user_id: string;
  name: string;
  avatar_url: string | null;
  total_xp: number;
}

export interface ClubRank {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  xp: number;
  isYou: boolean;
}

/** Best first, with the order the server sent breaking ties. */
export function rankClubMembers(rows: ClubRankRow[], myUserId: string | undefined): ClubRank[] {
  return [...rows]
    .sort((a, b) => b.total_xp - a.total_xp)
    .map((row, index) => ({
      rank: index + 1,
      userId: row.user_id,
      name: row.name,
      avatarUrl: trustedAvatarUrl(row.avatar_url),
      xp: row.total_xp,
      isYou: row.user_id === myUserId,
    }));
}
