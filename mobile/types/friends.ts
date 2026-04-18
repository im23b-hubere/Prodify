export type FriendIncomingDto = {
  id: number;
  user_id: number;
  username: string;
  created_at: string;
};

export type FriendLeaderboardEntryDto = {
  rank: number;
  user_id: number;
  username: string;
  current_streak_days: number;
  sessions_in_period: number;
};

export type FriendLeaderboardDto = {
  period: string;
  entries: FriendLeaderboardEntryDto[];
};

export type FriendActivityDto = {
  session_id: number;
  user_id: number;
  username: string;
  session_type: string;
  completed_at: string;
  duration_seconds: number;
};
