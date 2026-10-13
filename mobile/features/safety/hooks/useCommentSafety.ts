import type { TFunction } from "i18next";
import { useCallback } from "react";
import { Alert } from "react-native";

import { deleteSessionComment } from "../../../lib/moderation";
import type { SocialCommentDto } from "../../../types/friends";
import { type CommentAction, commentMenuActions } from "../safetyMenus";
import { type ActionMenuItem, showActionMenu } from "../showActionMenu";
import { useBlockUser } from "./useBlockUser";
import { useReportFlow } from "./useReportFlow";

type Options = {
  token: string | null | undefined;
  t: TFunction;
  sessionId: number | null;
  currentUserId: number | null | undefined;
  isOwnSession: boolean;
  /** Refetch the thread after a comment was removed or its author blocked. */
  onChanged: () => void;
};

/** Long-press options on a comment: delete, report or block, depending on who is looking. */
export function useCommentSafety({ token, t, sessionId, currentUserId, isOwnSession, onChanged }: Options) {
  const report = useReportFlow(token, t);
  const requestBlock = useBlockUser(token, t);
  const { open: openReport, close: closeReport, target: reportTarget } = report;

  const confirmDelete = useCallback(
    (comment: SocialCommentDto) => {
      if (!token || sessionId == null) return;
      Alert.alert(t("safety.comment.deleteTitle"), t("safety.comment.deleteBody"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("safety.comment.deleteAction"),
          style: "destructive",
          onPress: () => {
            deleteSessionComment(token, sessionId, comment.id)
              .then(onChanged)
              .catch(() => Alert.alert(t("safety.comment.deleteFailed"), t("common.tryAgain")));
          },
        },
      ]);
    },
    [onChanged, sessionId, t, token],
  );

  const openCommentMenu = useCallback(
    (comment: SocialCommentDto) => {
      const actions = commentMenuActions({
        isOwnComment: comment.author_id === currentUserId,
        isSessionOwner: isOwnSession,
      });
      const item = (action: CommentAction): ActionMenuItem => {
        if (action === "delete") {
          return { label: t("safety.menu.deleteComment"), destructive: true, onSelect: () => confirmDelete(comment) };
        }
        if (action === "report") {
          return {
            label: t("safety.menu.report"),
            onSelect: () =>
              openReport({
                kind: "comment",
                commentId: comment.id,
                authorId: comment.author_id,
                name: comment.author_username,
              }),
          };
        }
        return {
          label: t("safety.menu.block"),
          destructive: true,
          onSelect: () => requestBlock({ userId: comment.author_id, name: comment.author_username }, onChanged),
        };
      };
      showActionMenu({ title: comment.author_username, cancelLabel: t("common.cancel"), items: actions.map(item) });
    },
    [confirmDelete, currentUserId, isOwnSession, onChanged, openReport, requestBlock, t],
  );

  const blockAfterReport = useCallback(() => {
    if (reportTarget?.kind !== "comment") return;
    closeReport();
    requestBlock({ userId: reportTarget.authorId, name: reportTarget.name }, onChanged);
  }, [closeReport, onChanged, reportTarget, requestBlock]);

  return { openCommentMenu, report, blockAfterReport };
}

export type CommentSafety = ReturnType<typeof useCommentSafety>;
