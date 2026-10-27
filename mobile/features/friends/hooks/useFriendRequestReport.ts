import type { TFunction } from "i18next";
import { useCallback } from "react";

import type { FriendIncomingDto } from "../../../types/friends";
import { useReportFlow } from "../../safety/hooks/useReportFlow";

type DeclineAndBlock = (request: Pick<FriendIncomingDto, "user_id" | "username">) => void;

/** A request shows a stranger's name and photo, so it can be reported before ever opening it. */
export function useFriendRequestReport(
  token: string | null | undefined,
  t: TFunction,
  declineAndBlock: DeclineAndBlock,
) {
  const report = useReportFlow(token, t);
  const { open, close, target } = report;

  const reportRequest = useCallback(
    (request: FriendIncomingDto) =>
      open({ kind: "user", userId: request.user_id, name: request.username }),
    [open],
  );

  const blockAfterReport = useCallback(() => {
    if (target?.kind !== "user") return;
    close();
    declineAndBlock({ user_id: target.userId, username: target.name });
  }, [close, declineAndBlock, target]);

  return { report, reportRequest, blockAfterReport };
}

export type FriendRequestReport = ReturnType<typeof useFriendRequestReport>;
