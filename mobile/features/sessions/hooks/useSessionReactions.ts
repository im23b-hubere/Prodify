import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";

import { fetchSessionReactions, toggleSessionReaction } from "../../../lib/social";
import type { SocialReactionDto } from "../../../types/friends";
import { validSessionId } from "./sessionSocialUtils";

export function useSessionReactions(
  token: string | null | undefined,
  sessionId: string | undefined,
  t: TFunction,
) {
  const [reactions, setReactions] = useState<SocialReactionDto[]>([]);
  const [reactionsLoading, setReactionsLoading] = useState(false);
  const [reactionsError, setReactionsError] = useState<string | null>(null);
  const [reactionBusyEmoji, setReactionBusyEmoji] = useState<string | null>(null);
  const loadReactions = useCallback(async () => {
    const id = validSessionId(sessionId);
    if (!token || id === null) return;
    setReactionsLoading(true);
    setReactionsError(null);
    try {
      const loaded = await fetchSessionReactions(token, id);
      setReactions(Array.isArray(loaded) ? loaded : []);
    } catch {
      setReactions([]);
      setReactionsError(t("sessionDetail.reactionsLoadFailed"));
    } finally {
      setReactionsLoading(false);
    }
  }, [sessionId, t, token]);
  useEffect(() => {
    void loadReactions();
  }, [loadReactions]);
  const toggleReaction = useCallback(
    async (emoji: string) => {
      const id = validSessionId(sessionId);
      if (!token || id === null || reactionBusyEmoji) return;
      setReactionBusyEmoji(emoji);
      setReactionsError(null);
      try {
        setReactions(await toggleSessionReaction(token, id, emoji));
        Haptics.selectionAsync().catch(() => undefined);
      } catch (error) {
        setReactionsError(
          error instanceof Error ? error.message : t("sessionDetail.reactionToggleFailed"),
        );
      } finally {
        setReactionBusyEmoji(null);
      }
    },
    [reactionBusyEmoji, sessionId, t, token],
  );
  return {
    reactions,
    reactionsLoading,
    reactionsError,
    reactionBusyEmoji,
    loadReactions,
    toggleReaction,
  };
}
