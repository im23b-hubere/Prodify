import type { TFunction } from "i18next";
import { useCallback } from "react";

import type { FriendStatus } from "../../profile/hooks/useFriendProfile";
import { profileMenuActions } from "../safetyMenus";
import { showActionMenu } from "../showActionMenu";
import { useBlockUser } from "./useBlockUser";
import { useReportFlow } from "./useReportFlow";

type Options = {
  token: string | null | undefined;
  t: TFunction;
  userId: number | null;
  name: string | null;
  status: FriendStatus | null;
  friendshipId: number | null;
  onBlocked: () => void;
  onUnfriend: (friendshipId: number) => void;
};

/** The "…" menu on someone's profile: unfriend, report, or block. */
export function useProfileSafety({
  token,
  t,
  userId,
  name,
  status,
  friendshipId,
  onBlocked,
  onUnfriend,
}: Options) {
  const report = useReportFlow(token, t);
  const requestBlock = useBlockUser(token, t);
  const actions = profileMenuActions(status);
  const { open: openReport, close: closeReport } = report;

  const block = useCallback(() => {
    if (userId == null || !name) return;
    requestBlock({ userId, name }, onBlocked);
  }, [name, onBlocked, requestBlock, userId]);

  const openMenu = useCallback(() => {
    if (userId == null || !name) return;
    showActionMenu({
      title: name,
      cancelLabel: t("common.cancel"),
      items: actions.flatMap((action) => {
        if (action === "unfriend") {
          if (friendshipId == null) return [];
          return [
            {
              label: t("safety.menu.unfriend"),
              destructive: true,
              onSelect: () => onUnfriend(friendshipId),
            },
          ];
        }
        if (action === "report") {
          return [
            {
              label: t("safety.menu.report"),
              onSelect: () => openReport({ kind: "user", userId, name }),
            },
          ];
        }
        return [{ label: t("safety.menu.block"), destructive: true, onSelect: block }];
      }),
    });
  }, [actions, block, friendshipId, name, onUnfriend, openReport, t, userId]);

  const blockAfterReport = useCallback(() => {
    closeReport();
    block();
  }, [block, closeReport]);

  return {
    openMenu: actions.length > 0 && userId != null && name ? openMenu : undefined,
    report,
    blockAfterReport,
  };
}
