import type { TFunction } from "i18next";
import { useCallback } from "react";

import { useSessionComments } from "./useSessionComments";
import { useSessionReactions } from "./useSessionReactions";

type Options = {
  token?: string | null;
  userId?: number | null;
  sessionId?: string;
  t: TFunction;
};

export function useSessionSocial({ token, userId, sessionId, t }: Options) {
  const comments = useSessionComments(token, userId, sessionId, t);
  const reactions = useSessionReactions(token, userId, sessionId, t);
  const { loadComments } = comments;
  const { loadReactions } = reactions;
  const refresh = useCallback(async () => {
    await loadComments();
    await loadReactions();
  }, [loadComments, loadReactions]);
  return { ...comments, ...reactions, refresh };
}
