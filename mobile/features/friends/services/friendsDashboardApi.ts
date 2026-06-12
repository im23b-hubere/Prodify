import { apiJson } from "../../../lib/client";
import {
  fetchBuddyStatus,
  fetchChallenges,
  fetchCheckinStatus,
  fetchCommitment,
  fetchWeeklyRecap,
} from "../../../lib/social";
import type {
  BuddyStatusDto,
  CheckinStatusDto,
  CommitmentDto,
  FriendActivityDto,
  FriendIncomingDto,
  FriendLeaderboardDto,
  SocialChallengeDto,
  SocialRecapDto,
} from "../../../types/friends";

export type FriendsDashboardSnapshot = {
  leaderboard: FriendLeaderboardDto;
  activity: FriendActivityDto[];
  incoming: FriendIncomingDto[];
  buddy: BuddyStatusDto | null;
  checkin: CheckinStatusDto | null;
  challenges: SocialChallengeDto[];
  commitment: CommitmentDto | null;
  recap: SocialRecapDto | null;
};

export async function loadFriendsDashboard(token: string, periodParam: "week" | "all") {
  const [leaderboard, activity, incoming, buddy, checkin, challenges, commitment, recap] =
    await Promise.all([
      apiJson<FriendLeaderboardDto>(`/friends/leaderboard?period=${periodParam}`, { token }),
      apiJson<FriendActivityDto[]>("/friends/activity?limit=20", { token }),
      apiJson<FriendIncomingDto[]>("/friends/incoming", { token }),
      fetchBuddyStatus(token).catch(() => null),
      fetchCheckinStatus(token).catch(() => null),
      fetchChallenges(token).catch(() => []),
      fetchCommitment(token).catch(() => null),
      fetchWeeklyRecap(token).catch(() => null),
    ]);

  const snapshot: FriendsDashboardSnapshot = {
    leaderboard,
    activity: Array.isArray(activity) ? activity : [],
    incoming: Array.isArray(incoming) ? incoming : [],
    buddy,
    checkin,
    challenges,
    commitment,
    recap,
  };
  return snapshot;
}
