import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ScrollView } from "react-native";

import { useAuth } from "../../../context/AuthContext";
import { useAuthScopedReset } from "../../../lib/authScopedReset";
import {
  buildSessionDetailPresentation,
  resolveSessionDetailParams,
} from "../sessionDetailPresentation";
import { useSessionDetailData } from "./useSessionDetailData";
import { useSessionEditor } from "./useSessionEditor";
import { useSessionSocial } from "./useSessionSocial";

export function useSessionDetailController() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; ownerName?: string | string[] }>();
  const { sessionId, ownerName } = resolveSessionDetailParams(
    params.id,
    params.ownerName,
    useSegments() as string[],
  );
  const social = useSessionSocial({ token, userId: user?.id, sessionId, t });
  const data = useSessionDetailData({
    token,
    userId: user?.id,
    sessionId,
    t,
    refreshSocial: social.refresh,
  });
  const [shareOpen, setShareOpen] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const closeShare = useCallback(() => setShareOpen(false), []);
  useAuthScopedReset(token, user?.id, closeShare);
  const editor = useSessionEditor({
    token,
    sessionId,
    session: data.session,
    currentUserId: user?.id,
    t,
    onSessionUpdated: data.setSession,
    onClose: router.back,
    onError: data.setError,
  });
  const isOwnSession = Boolean(user?.id != null && data.session?.user_id === user.id);
  const producerName =
    ownerName?.trim() ||
    (isOwnSession ? user?.username : undefined) ||
    t("sessionDetail.friendProducerFallback");
  return {
    t,
    user,
    ...social,
    ...data,
    ...editor,
    shareOpen,
    scrollRef,
    isOwnSession,
    producerName,
    presentation: data.session
      ? buildSessionDetailPresentation(data.session, data.insights, t)
      : null,
    closeShare,
    openShare: () => setShareOpen(true),
    goBack: () => router.back(),
    resumeActive: () => {
      if (typeof data.session?.id !== "number" || !Number.isFinite(data.session.id)) return;
      router.push({
        pathname: "/session-active",
        params: { id: String(data.session.id), source: "session_detail" },
      });
    },
    openProfile: () => {
      if (!data.session) return;
      Haptics.selectionAsync().catch(() => undefined);
      router.push(`/profile/${data.session.user_id}`);
    },
    focusComment: () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120),
  };
}

export type SessionDetailController = ReturnType<typeof useSessionDetailController>;
