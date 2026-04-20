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
  sessions_delta_vs_prior?: number;
  trend?: "up" | "down" | "flat";
  is_chasing_you?: boolean;
  is_threatening_you?: boolean;
  is_premium?: boolean;
  profile_picture_url?: string | null;
};

export type FriendLeaderboardDto = {
  period: string;
  entries: FriendLeaderboardEntryDto[];
};

export type FriendActivityDto = {
  session_id: number;
  user_id: number;
  username: string;
  profile_picture_url?: string | null;
  session_type: string;
  activity_at: string;
  status?: "live" | "completed" | string;
  completed_at?: string | null;
  duration_seconds?: number | null;
  reactions_count?: number;
  comments_count?: number;
  viewer_reaction?: string | null;
};

export type BuddyStatusDto = {
  invite_id?: number | null;
  status: "none" | "pending_outgoing" | "pending_incoming" | "active";
  buddy_user_id?: number | null;
  buddy_username?: string | null;
  this_week_sessions?: number;
  buddy_week_sessions?: number;
};

export type CheckinDayStateDto = {
  day_key: string;
  state: "done" | "open" | "missed";
};

export type CheckinStatusDto = {
  week_start: string;
  target_checkins: number;
  done_count: number;
  on_track: boolean;
  day_states: CheckinDayStateDto[];
};

export type SocialChallengeMemberDto = {
  user_id: number;
  username: string;
  progress_sessions: number;
  team_label?: string | null;
};

export type SocialChallengeDto = {
  id: number;
  challenge_kind: "duel" | "team" | "group" | string;
  title: string;
  week_start: string;
  target_sessions: number;
  duration_days?: number;
  status: string;
  premium_detail_locked?: boolean;
  upsell_hint?: string | null;
  members: SocialChallengeMemberDto[];
};

export type CommitmentDto = {
  week_start: string;
  commitment_key?: string;
  period_days?: number;
  target_sessions: number;
  current_sessions: number;
  status: "on_track" | "behind" | "completed";
  visibility: string;
  upsell_hint?: string | null;
};

export type SocialReactionDto = {
  target_type: string;
  target_id: number;
  emoji: string;
  count: number;
  reacted_by_me: boolean;
};

export type SocialReactionUserDto = {
  user_id: number;
  username: string;
  emoji: string;
  created_at: string;
};

export type SocialRecapDto = {
  week_start: string;
  your_sessions: number;
  buddy_sessions: number;
  team_sessions: number;
  wow_delta_sessions: number;
  has_active_buddy?: boolean;
  identity_tag?: string | null;
  trend_vs_last_week_percent?: number | null;
  premium_detail_locked?: boolean;
  upsell_hint?: string | null;
};

export type SocialCommentDto = {
  id: number;
  target_type: string;
  target_id: number;
  author_id: number;
  author_username: string;
  author_profile_picture_url?: string | null;
  body: string;
  created_at: string;
};

export type BuddyRiskDto = {
  buddy_user_id?: number | null;
  buddy_username?: string | null;
  buddy_streak_at_risk: boolean;
  rescue_available: boolean;
  rescued_today: boolean;
};

export type IdentityStateDto = {
  primary_tag:
    | "creator"
    | "consistent_creator"
    | "collaborative"
    | "competitive"
    | "locked_in"
    | "building_momentum"
    | string;
  secondary_tag?: string | null;
  tags: string[];
  line: string;
};
