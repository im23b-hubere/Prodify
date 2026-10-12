import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

import { type BlockedUserDto, fetchBlockedUsers, unblockUser } from "../../../lib/moderation";

export type BlockedUsersStatus = "loading" | "ready" | "error";

export function useBlockedUsers(token: string | null | undefined, t: TFunction) {
  const [users, setUsers] = useState<BlockedUserDto[]>([]);
  const [status, setStatus] = useState<BlockedUsersStatus>("loading");
  const [unblockingIds, setUnblockingIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setStatus("loading");
    try {
      setUsers(await fetchBlockedUsers(token));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = useCallback(
    async (user: BlockedUserDto) => {
      if (!token) return;
      setUnblockingIds((ids) => [...ids, user.user_id]);
      try {
        await unblockUser(token, user.user_id);
        setUsers((current) => current.filter((listed) => listed.user_id !== user.user_id));
      } catch {
        Alert.alert(t("safety.blocked.unblockFailed"), t("common.tryAgain"));
      } finally {
        setUnblockingIds((ids) => ids.filter((id) => id !== user.user_id));
      }
    },
    [t, token],
  );

  return { users, status, unblockingIds, reload: load, unblock };
}
