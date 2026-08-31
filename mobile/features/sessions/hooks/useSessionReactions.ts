import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthScopedReset } from "../../../lib/authScopedReset";
import { fetchSessionReactions, toggleSessionReaction } from "../../../lib/social";
import type { SocialReactionDto } from "../../../types/friends";
import { validSessionId } from "./sessionSocialUtils";

export function useSessionReactions(
  token: string | null | undefined,
  userId: number | null | undefined,
  sessionId: string | undefined,
  t: TFunction,
) {
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const loadSequence = useRef(0);
  const [reactions, setReactions] = useState<SocialReactionDto[]>([]);
  const [reactionsLoading, setReactionsLoading] = useState(false);
  const [reactionsError, setReactionsError] = useState<string | null>(null);
  const [reactionBusyEmoji, setReactionBusyEmoji] = useState<string | null>(null);

  const resetReactionsState = useCallback(() => {
    loadSequence.current += 1;
    setReactions([]);
    setReactionsError(null);
    setReactionsLoading(false);
    setReactionBusyEmoji(null);
  }, []);

  useAuthScopedReset(token ?? null, userId, resetReactionsState);

  const loadReactions = useCallback(async () => {
    const currentToken = tokenRef.current;
    const id = validSessionId(sessionId);
    const sequence = ++loadSequence.current;

    if (!currentToken || userId == null || id === null) {
      if (sequence !== loadSequence.current) return;
      setReactions([]);
      setReactionsError(null);
      setReactionsLoading(false);
      return;
    }

    setReactionsLoading(true);
    setReactionsError(null);
    try {
      const loaded = await fetchSessionReactions(currentToken, id);
      if (sequence !== loadSequence.current) return;
      setReactions(Array.isArray(loaded) ? loaded : []);
    } catch {
      if (sequence !== loadSequence.current) return;
      setReactions([]);
      setReactionsError(t("sessionDetail.reactionsLoadFailed"));
    } finally {
      if (sequence === loadSequence.current) setReactionsLoading(false);
    }
  }, [sessionId, t, userId]);

  useEffect(() => {
    if (!tokenRef.current || userId == null) {
      if (!tokenRef.current) {
        setReactions([]);
        setReactionsError(null);
        setReactionsLoading(false);
      }
      return;
    }
    void loadReactions();
  }, [loadReactions, sessionId, userId]);

  const toggleReaction = useCallback(
    async (emoji: string) => {
      const currentToken = tokenRef.current;
      const id = validSessionId(sessionId);
      if (!currentToken || userId == null || id === null || reactionBusyEmoji) return;
      setReactionBusyEmoji(emoji);
      setReactionsError(null);
      try {
        const updated = await toggleSessionReaction(currentToken, id, emoji);
        setReactions(updated);
        Haptics.selectionAsync().catch(() => undefined);
      } catch (error) {
        setReactionsError(
          error instanceof Error ? error.message : t("sessionDetail.reactionToggleFailed"),
        );
      } finally {
        setReactionBusyEmoji(null);
      }
    },
    [reactionBusyEmoji, sessionId, t, userId],
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
