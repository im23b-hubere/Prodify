import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { createSessionComment, fetchSessionComments } from "../../../lib/social";
import type { SocialCommentDto } from "../../../types/friends";
import { validSessionId } from "./sessionSocialUtils";

export function useSessionComments(
  token: string | null | undefined,
  sessionId: string | undefined,
  t: TFunction,
) {
  const [comments, setComments] = useState<SocialCommentDto[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentSending, setCommentSending] = useState(false);
  const success = useCommentSuccessFeedback();
  const loadComments = useCallback(async () => {
    const id = validSessionId(sessionId);
    if (!token || id === null) return;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const loaded = await fetchSessionComments(token, id);
      setComments(Array.isArray(loaded) ? loaded : []);
    } catch {
      setComments([]);
      setCommentsError(t("sessionDetail.commentsLoadFailed"));
    } finally {
      setCommentsLoading(false);
    }
  }, [sessionId, t, token]);
  useEffect(() => {
    void loadComments();
  }, [loadComments]);
  const submitComment = useCallback(async () => {
    const id = validSessionId(sessionId);
    const body = commentInput.trim();
    if (!token || id === null || !body) return;
    setCommentSending(true);
    try {
      const created = await createSessionComment(token, id, body);
      setCommentInput("");
      await loadComments();
      success.show(created.id);
      Haptics.selectionAsync().catch(() => undefined);
    } catch (error) {
      Alert.alert(
        t("friendsScreen.couldNotSendComment"),
        error instanceof Error ? error.message : t("common.tryAgain"),
      );
    } finally {
      setCommentSending(false);
    }
  }, [commentInput, loadComments, sessionId, success, t, token]);
  return {
    comments,
    commentInput,
    setCommentInput,
    commentsLoading,
    commentsError,
    commentSending,
    newCommentId: success.commentId,
    commentSentPulse: success.pulse,
    loadComments,
    submitComment,
  };
}

function useCommentSuccessFeedback() {
  const [commentId, setCommentId] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    },
    [],
  );
  const show = useCallback((id: number) => {
    setCommentId(id);
    setPulse(true);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    highlightTimer.current = setTimeout(() => setCommentId(null), 1800);
    pulseTimer.current = setTimeout(() => setPulse(false), 900);
  }, []);
  return { commentId, pulse, show };
}
