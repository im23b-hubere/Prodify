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
  onBlocked: () => void;
};

/** The "…" menu on someone's profile: report them or block them. */
export function useProfileSafety({ token, t, userId, name, status, onBlocked }: Options) {
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
      items: actions.map((action) =>
        action === "report"
          ? {
              label: t("safety.menu.report"),
              onSelect: () => openReport({ kind: "user", userId, name }),
            }
          : { label: t("safety.menu.block"), destructive: true, onSelect: block },
      ),
    });
  }, [actions, block, name, openReport, t, userId]);

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
