import { apiJson } from "./client";
import type {
  BuddyRiskDto,
  BuddyStatusDto,
  CheckinStatusDto,
  CommitmentDto,
  IdentityStateDto,
  SocialCommentDto,
  SocialChallengeDto,
  SocialReactionDto,
  SocialReactionUserDto,
  SocialRecapDto,
} from "../types/friends";

export async function fetchBuddyStatus(token: string): Promise<BuddyStatusDto> {
  return apiJson<BuddyStatusDto>("/social/buddy", { token });
}

export async function fetchCheckinStatus(token: string): Promise<CheckinStatusDto> {
  return apiJson<CheckinStatusDto>("/social/checkins/status", { token });
}

export async function fetchChallenges(token: string): Promise<SocialChallengeDto[]> {
  return apiJson<SocialChallengeDto[]>("/social/challenges", { token });
}

export async function fetchChallenge(
  token: string,
  challengeId: number,
): Promise<SocialChallengeDto> {
  return apiJson<SocialChallengeDto>(`/social/challenges/${challengeId}`, { token });
}

export async function fetchCommitment(token: string): Promise<CommitmentDto | null> {
  return apiJson<CommitmentDto | null>("/social/commitment", { token });
}

export async function fetchWeeklyRecap(token: string): Promise<SocialRecapDto> {
  return apiJson<SocialRecapDto>("/social/weekly-recap", { token });
}

export async function fetchSessionReactions(
  token: string,
  sessionId: number,
): Promise<SocialReactionDto[]> {
  return apiJson<SocialReactionDto[]>(`/social/feed/${sessionId}/reactions`, { token });
}

export async function toggleSessionReaction(
  token: string,
  sessionId: number,
  emoji = "👍",
): Promise<SocialReactionDto[]> {
  return apiJson<SocialReactionDto[]>(`/social/feed/${sessionId}/reactions`, {
    token,
    method: "POST",
    body: { emoji },
  });
}

export async function fetchSessionReactionUsers(
  token: string,
  sessionId: number,
): Promise<SocialReactionUserDto[]> {
  return apiJson<SocialReactionUserDto[]>(`/social/feed/${sessionId}/reactions/users`, { token });
}

export async function fetchSessionComments(
  token: string,
  sessionId: number,
): Promise<SocialCommentDto[]> {
  return apiJson<SocialCommentDto[]>(`/social/feed/${sessionId}/comments`, { token });
}

export async function createSessionComment(
  token: string,
  sessionId: number,
  body: string,
): Promise<SocialCommentDto> {
  return apiJson<SocialCommentDto>(`/social/feed/${sessionId}/comments`, {
    token,
    method: "POST",
    body: { body },
  });
}

export async function joinSocialChallenge(
  token: string,
  challengeId: number,
): Promise<SocialChallengeDto> {
  return apiJson<SocialChallengeDto>("/social/challenges/join", {
    token,
    method: "POST",
    body: { challenge_id: challengeId },
  });
}

export async function createChallenge(
  token: string,
  payload: {
    challenge_kind: "duel" | "team" | "group";
    title: string;
    target_sessions: number;
    duration_days: number;
    member_user_ids: number[];
  },
): Promise<SocialChallengeDto> {
  return apiJson<SocialChallengeDto>("/social/challenges", {
    token,
    method: "POST",
    body: payload,
  });
}

export async function updateChallenge(
  token: string,
  challengeId: number,
  payload: {
    title?: string;
    target_sessions?: number;
    duration_days?: number;
  },
): Promise<SocialChallengeDto> {
  return apiJson<SocialChallengeDto>(`/social/challenges/${challengeId}`, {
    token,
    method: "PATCH",
    body: payload,
  });
}

export async function cancelChallenge(token: string, challengeId: number): Promise<void> {
  await apiJson(`/social/challenges/${challengeId}`, {
    token,
    method: "DELETE",
  });
}

export async function leaveChallenge(token: string, challengeId: number): Promise<void> {
  await apiJson(`/social/challenges/${challengeId}/leave`, {
    token,
    method: "POST",
  });
}

export async function fetchCommitments(token: string): Promise<CommitmentDto[]> {
  return apiJson<CommitmentDto[]>("/social/commitments", { token });
}

export async function fetchBuddyRisk(token: string): Promise<BuddyRiskDto> {
  return apiJson<BuddyRiskDto>("/social/buddy/risk", { token });
}

export async function rescueBuddyStreak(token: string, rescuedUserId: number): Promise<void> {
  await apiJson("/social/streak/rescue", {
    token,
    method: "POST",
    body: { rescued_user_id: rescuedUserId },
  });
}

export async function fetchIdentityState(token: string): Promise<IdentityStateDto> {
  return apiJson<IdentityStateDto>("/social/identity", { token });
}
