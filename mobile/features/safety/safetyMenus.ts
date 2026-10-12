import type { FriendStatus } from "../profile/hooks/useFriendProfile";

export type CommentAction = "delete" | "report" | "block";
export type ProfileAction = "report" | "block";

export function commentMenuActions({
  isOwnComment,
  isSessionOwner,
}: {
  isOwnComment: boolean;
  isSessionOwner: boolean;
}): CommentAction[] {
  if (isOwnComment) return ["delete"];
  return isSessionOwner ? ["delete", "report", "block"] : ["report", "block"];
}

export function profileMenuActions(status: FriendStatus | null): ProfileAction[] {
  if (status === null || status === "self") return [];
  return ["report", "block"];
}
