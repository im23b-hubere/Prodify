import type { TFunction } from "i18next";
import { useCallback } from "react";

import { useSessionComments } from "./useSessionComments";
import { useSessionReactions } from "./useSessionReactions";

type Options = { token?: string | null; sessionId?: string; t: TFunction };

export function useSessionSocial({ token, sessionId, t }: Options) {
  const comments = useSessionComments(token, sessionId, t);
  const reactions = useSessionReactions(token, sessionId, t);
  const { loadComments } = comments;
  const { loadReactions } = reactions;
  const refresh = useCallback(async () => {
    await loadComments();
    await loadReactions();
  }, [loadComments, loadReactions]);
  return { ...comments, ...reactions, refresh };
}
