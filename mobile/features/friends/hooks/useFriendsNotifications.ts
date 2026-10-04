import type { TFunction } from "i18next";
import { useEffect } from "react";

import { prependNotification } from "../../../lib/notificationInbox";
import { sendLocalSocialNotification } from "../../../lib/socialNotifications";
import type { FriendActivityDto, FriendIncomingDto } from "../../../types/friends";

const DAY_MS = 24 * 60 * 60 * 1000;

export function useFriendsNotifications(
  incomingRequests: FriendIncomingDto[],
  activity: FriendActivityDto[],
  currentUserId: number | undefined,
  t: TFunction,
) {
  useEffect(() => {
    for (const request of incomingRequests) {
      const title = t("notificationsUi.friendRequestTitle");
      const body = t("notificationsUi.friendRequestBody", { username: request.username });
      prependNotification({
        id: `social-friend-request-${request.id}`,
        category: "social",
        priority: "normal",
        title,
        body,
        actionLabel: t("notificationsUi.openFriends"),
        actionRoute: "/(tabs)/friends",
        ttlMs: 7 * DAY_MS,
        dedupeWindowMs: 5 * 60 * 1000,
      })
        .then((inserted) =>
          inserted
            ? sendLocalSocialNotification({
                title,
                body,
                path: "/(tabs)/friends",
                throttleKey: `friend-request-${request.id}`,
                throttleMs: 30_000,
              })
            : undefined,
        )
        .catch(() => undefined);
    }
  }, [incomingRequests, t]);

  useEffect(() => {
    if (!currentUserId) return;
    for (const item of activity) {
      const commentsCount = item.comments_count ?? 0;
      if (item.user_id !== currentUserId || item.session_id <= 0 || commentsCount <= 0) continue;

      const title = t("notificationsUi.newCommentTitle");
      const body = t("notificationsUi.newCommentBody", { count: commentsCount });
      const sessionPath = `/session/${item.session_id}`;
      prependNotification({
        id: `social-comment-${item.session_id}-${commentsCount}`,
        category: "social",
        priority: "normal",
        title,
        body,
        actionLabel: t("notificationsUi.openSession"),
        actionRoute: sessionPath,
        ttlMs: 5 * DAY_MS,
        dedupeWindowMs: 2 * 60 * 1000,
      })
        .then((inserted) =>
          inserted
            ? sendLocalSocialNotification({
                title,
                body,
                path: sessionPath,
                throttleKey: `comment-session-${item.session_id}`,
                throttleMs: 60_000,
              })
            : undefined,
        )
        .catch(() => undefined);
    }
  }, [activity, currentUserId, t]);
}
