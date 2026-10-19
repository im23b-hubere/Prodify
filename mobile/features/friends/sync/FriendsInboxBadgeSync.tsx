import { useEffect } from "react";

import { useAuth } from "../../../context/AuthContext";
import { apiJson } from "../../../lib/client";
import type { FriendIncomingDto } from "../../../types/friends";
import { setIncomingFriendRequestCount } from "./friendsInboxBadge";
import { subscribeFriendsSync } from "./friendsSync";

async function refreshIncomingCount(token: string) {
  try {
    const incoming = await apiJson<FriendIncomingDto[]>("/friends/incoming", { token });
    setIncomingFriendRequestCount(Array.isArray(incoming) ? incoming.length : 0);
  } catch {
    // Keep the last known badge; a later sync or Friends load will correct it.
  }
}

/**
 * Keeps the Friends tab badge current even when the Friends screen is not mounted
 * (lazy tabs + push/foreground sync).
 */
export function FriendsInboxBadgeSync() {
  const { token, user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!token || userId == null) {
      setIncomingFriendRequestCount(0);
      return;
    }
    void refreshIncomingCount(token);
    return subscribeFriendsSync(() => {
      void refreshIncomingCount(token);
    });
  }, [token, userId]);

  return null;
}
