import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Alert } from "react-native";

import {
  createSessionComment,
  fetchSessionComments,
  fetchSessionReactions,
  toggleSessionReaction,
} from "../../../lib/social";
import type { SocialCommentDto, SocialReactionDto } from "../../../types/friends";

type UseSessionSocialOptions = {
  token?: string | null;
  sessionId?: string;
  t: TFunction;
};

export function useSessionSocial({ token, sessionId, t }: UseSessionSocialOptions) {
  const [comments, setComments] = useState<SocialCommentDto[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentSending, setCommentSending] = useState(false);
  const [reactions, setReactions] = useState<SocialReactionDto[]>([]);
  const [reactionsLoading, setReactionsLoading] = useState(false);
  const [reactionsError, setReactionsError] = useState<string | null>(null);
  const [reactionBusyEmoji, setReactionBusyEmoji] = useState<string | null>(null);
  const [newCommentId, setNewCommentId] = useState<number | null>(null);
  const [commentSentPulse, setCommentSentPulse] = useState(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const highlightTimeout = highlightTimeoutRef;
    const pulseTimeout = pulseTimeoutRef;
    return () => {
      if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
      if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
    };
  }, []);

  const loadComments = useCallback(async () => {
    const numericSessionId = validSessionId(sessionId);
    if (!token || numericSessionId === null) return;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const loadedComments = await fetchSessionComments(token, numericSessionId);
      setComments(Array.isArray(loadedComments) ? loadedComments : []);
    } catch {
      setComments([]);
      setCommentsError(t("sessionDetail.commentsLoadFailed"));
    } finally {
      setCommentsLoading(false);
    }
  }, [sessionId, t, token]);

  const loadReactions = useCallback(async () => {
    const numericSessionId = validSessionId(sessionId);
    if (!token || numericSessionId === null) return;
    setReactionsLoading(true);
    setReactionsError(null);
    try {
      const loadedReactions = await fetchSessionReactions(token, numericSessionId);
      setReactions(Array.isArray(loadedReactions) ? loadedReactions : []);
    } catch {
      setReactions([]);
      setReactionsError(t("sessionDetail.reactionsLoadFailed"));
    } finally {
      setReactionsLoading(false);
    }
  }, [sessionId, t, token]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    void loadReactions();
  }, [loadReactions]);

  const refresh = useCallback(async () => {
    await loadComments();
    await loadReactions();
  }, [loadComments, loadReactions]);

  const submitComment = useCallback(async () => {
    const numericSessionId = validSessionId(sessionId);
    const body = commentInput.trim();
    if (!token || numericSessionId === null || !body) return;
    setCommentSending(true);
    try {
      const created = await createSessionComment(token, numericSessionId, body);
      setCommentInput("");
      await loadComments();
      showCommentSuccess(
        created.id,
        setNewCommentId,
        setCommentSentPulse,
        highlightTimeoutRef,
        pulseTimeoutRef,
      );
      Haptics.selectionAsync().catch(() => undefined);
    } catch (error) {
      Alert.alert(
        t("friendsScreen.couldNotSendComment"),
        error instanceof Error ? error.message : t("common.tryAgain"),
      );
    } finally {
      setCommentSending(false);
    }
  }, [commentInput, loadComments, sessionId, t, token]);

  const toggleReaction = useCallback(
    async (emoji: string) => {
      const numericSessionId = validSessionId(sessionId);
      if (!token || numericSessionId === null || reactionBusyEmoji) return;
      setReactionBusyEmoji(emoji);
      setReactionsError(null);
      try {
        setReactions(await toggleSessionReaction(token, numericSessionId, emoji));
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
    comments,
    commentInput,
    setCommentInput,
    commentsLoading,
    commentsError,
    commentSending,
    reactions,
    reactionsLoading,
    reactionsError,
    reactionBusyEmoji,
    newCommentId,
    commentSentPulse,
    refresh,
    submitComment,
    toggleReaction,
  };
}

function validSessionId(sessionId?: string): number | null {
  if (!sessionId) return null;
  const numericSessionId = Number(sessionId);
  return Number.isFinite(numericSessionId) ? numericSessionId : null;
}

function showCommentSuccess(
  commentId: number,
  setHighlightedCommentId: (commentId: number | null) => void,
  setSentPulse: (active: boolean) => void,
  highlightTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  pulseTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
) {
  setHighlightedCommentId(commentId);
  setSentPulse(true);
  if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
  if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
  highlightTimeoutRef.current = setTimeout(() => setHighlightedCommentId(null), 1800);
  pulseTimeoutRef.current = setTimeout(() => setSentPulse(false), 900);
}
