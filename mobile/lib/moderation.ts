import { apiJson } from "./client";

export type ReportReason = "spam" | "harassment" | "hate" | "sexual" | "other";

export type ReportDraft = { reason: ReportReason; note: string };

export type BlockedUserDto = {
  user_id: number;
  username: string;
  profile_picture_url: string | null;
  blocked_at: string;
};

export async function blockUser(token: string, userId: number): Promise<void> {
  await apiJson(`/users/${userId}/block`, { token, method: "POST" });
}

export async function unblockUser(token: string, userId: number): Promise<void> {
  await apiJson(`/users/${userId}/block`, { token, method: "DELETE" });
}

export async function fetchBlockedUsers(token: string): Promise<BlockedUserDto[]> {
  return apiJson<BlockedUserDto[]>("/users/me/blocked", { token });
}

export async function reportUser(token: string, userId: number, draft: ReportDraft): Promise<void> {
  await sendReport(token, { target_type: "user", user_id: userId }, draft);
}

export async function reportComment(token: string, commentId: number, draft: ReportDraft): Promise<void> {
  await sendReport(token, { target_type: "comment", comment_id: commentId }, draft);
}

export async function deleteSessionComment(token: string, sessionId: number, commentId: number): Promise<void> {
  await apiJson(`/social/feed/${sessionId}/comments/${commentId}`, { token, method: "DELETE" });
}

async function sendReport(token: string, target: Record<string, unknown>, draft: ReportDraft): Promise<void> {
  await apiJson("/reports", {
    token,
    method: "POST",
    body: { ...target, reason: draft.reason, note: draft.note.trim() || null },
  });
}
