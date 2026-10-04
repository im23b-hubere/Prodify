import { apiJson } from "../../../lib/client";
import {
  fetchBuddyStatus,
  fetchChallenges,
  fetchCheckinStatus,
  fetchCommitment,
  fetchDuelRecords,
  fetchWeeklyRecap,
} from "../../../lib/social";
import type {
  BuddyStatusDto,
  CheckinStatusDto,
  CommitmentDto,
  DuelRecordDto,
  FriendActivityDto,
  FriendIncomingDto,
  FriendLeaderboardDto,
  SocialChallengeDto,
  SocialRecapDto,
} from "../../../types/friends";

/** `undefined` marks an optional part whose request failed, so the screen keeps its last good value. */
export type FriendsDashboardSnapshot = {
  leaderboard: FriendLeaderboardDto;
  activity: FriendActivityDto[];
  incoming: FriendIncomingDto[];
  buddy: BuddyStatusDto | null | undefined;
  checkin: CheckinStatusDto | null | undefined;
  challenges: SocialChallengeDto[] | undefined;
  duelRecords: DuelRecordDto[] | undefined;
  commitment: CommitmentDto | null | undefined;
  recap: SocialRecapDto | null | undefined;
};

function unlessFailed<T>(request: Promise<T>): Promise<T | undefined> {
  return request.catch(() => undefined);
}

export async function loadFriendsDashboard(token: string, periodParam: "week" | "all") {
  const [
    leaderboard,
    activity,
    incoming,
    buddy,
    checkin,
    challenges,
    duelRecords,
    commitment,
    recap,
  ] = await Promise.all([
    apiJson<FriendLeaderboardDto>(`/friends/leaderboard?period=${periodParam}`, { token }),
    apiJson<FriendActivityDto[]>("/friends/activity?limit=20", { token }),
    apiJson<FriendIncomingDto[]>("/friends/incoming", { token }),
    unlessFailed(fetchBuddyStatus(token)),
    unlessFailed(fetchCheckinStatus(token)),
    unlessFailed(fetchChallenges(token)),
    unlessFailed(fetchDuelRecords(token)),
    unlessFailed(fetchCommitment(token)),
    unlessFailed(fetchWeeklyRecap(token)),
  ]);

  const snapshot: FriendsDashboardSnapshot = {
    leaderboard,
    activity: Array.isArray(activity) ? activity : [],
    incoming: Array.isArray(incoming) ? incoming : [],
    buddy,
    checkin,
    challenges,
    duelRecords: duelRecords === undefined || Array.isArray(duelRecords) ? duelRecords : [],
    commitment,
    recap,
  };
  return snapshot;
}
