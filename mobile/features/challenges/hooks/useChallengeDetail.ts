import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import {
  cancelChallenge,
  fetchChallenge,
  joinSocialChallenge,
  leaveChallenge,
  updateChallenge,
} from "../../../lib/social";
import type { SocialChallengeDto } from "../../../types/friends";
import {
  challengeLeader,
  challengeOutcome,
  remainingChallengeDays,
  totalChallengeSessions,
} from "../challengeDetailPresentation";

type ChallengeAction = "join" | "leave" | "cancel";

export function useChallengeDetail(
  token: string | null | undefined,
  challengeId: number | null,
  currentUserId: number | undefined,
) {
  const { t } = useTranslation();
  const router = useRouter();
  const [challenge, setChallenge] = useState<SocialChallengeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyActionKey, setBusyActionKey] = useState<ChallengeAction | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTarget, setEditTarget] = useState("5");
  const [editDuration, setEditDuration] = useState("7");
  const [editBusy, setEditBusy] = useState(false);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token || challengeId == null) {
        setChallenge(null);
        setError(challengeId == null ? t("challengeDetail.invalidChallenge") : null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const silent = options?.silent ?? false;
      setError(null);
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        setChallenge(await fetchChallenge(token, challengeId));
      } catch (loadError) {
        setChallenge(null);
        setError(loadError instanceof Error ? loadError.message : t("challengeDetail.loadError"));
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [challengeId, t, token],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openEdit = useCallback(() => {
    if (!challenge) return;
    setEditTitle(challenge.title);
    setEditTarget(String(challenge.target_sessions));
    setEditDuration(String(challenge.duration_days ?? 7));
    setEditOpen(true);
  }, [challenge]);

  const submitEdit = useCallback(async () => {
    if (!token || challengeId == null) return;
    const title = editTitle.trim();
    const target = Number.parseInt(editTarget, 10);
    const durationDays = Number.parseInt(editDuration, 10);
    if (
      title.length < 3 ||
      target < 1 ||
      !Number.isFinite(target) ||
      durationDays < 3 ||
      !Number.isFinite(durationDays)
    ) {
      Alert.alert(
        t("friendsScreen.invalidChallengeTitle"),
        t("friendsScreen.invalidChallengeBody"),
      );
      return;
    }
    setEditBusy(true);
    try {
      setChallenge(
        await updateChallenge(token, challengeId, {
          title,
          target_sessions: target,
          duration_days: durationDays,
        }),
      );
      setEditOpen(false);
    } catch (updateError) {
      Alert.alert(
        t("friendsScreen.couldNotUpdateChallenge"),
        updateError instanceof Error ? updateError.message : t("common.tryAgain"),
      );
    } finally {
      setEditBusy(false);
    }
  }, [challengeId, editDuration, editTarget, editTitle, t, token]);

  const runExitAction = useCallback(
    async (action: Exclude<ChallengeAction, "join">) => {
      if (!token || challengeId == null) return;
      setBusyActionKey(action);
      try {
        if (action === "cancel") await cancelChallenge(token, challengeId);
        else await leaveChallenge(token, challengeId);
        router.back();
      } catch (actionError) {
        Alert.alert(
          t(
            action === "cancel"
              ? "friendsScreen.couldNotEndChallenge"
              : "friendsScreen.couldNotLeaveChallenge",
          ),
          actionError instanceof Error ? actionError.message : t("common.tryAgain"),
        );
      } finally {
        setBusyActionKey(null);
      }
    },
    [challengeId, router, t, token],
  );

  const confirmExit = useCallback(
    (action: Exclude<ChallengeAction, "join">) => {
      if (!token || challengeId == null) return;
      const cancelling = action === "cancel";
      Alert.alert(
        t(cancelling ? "friendsScreen.challengeEndTitle" : "friendsScreen.challengeLeaveTitle"),
        t(cancelling ? "friendsScreen.challengeEndBody" : "friendsScreen.challengeLeaveBody"),
        [
          { text: t("friendsScreen.modalCancel"), style: "cancel" },
          {
            text: t(
              cancelling
                ? "friendsScreen.challengeEndConfirm"
                : "friendsScreen.challengeLeaveConfirm",
            ),
            style: "destructive",
            onPress: () => void runExitAction(action),
          },
        ],
      );
    },
    [challengeId, runExitAction, t, token],
  );

  const join = useCallback(async () => {
    if (!token || challengeId == null) return;
    setBusyActionKey("join");
    try {
      setChallenge(await joinSocialChallenge(token, challengeId));
    } catch (joinError) {
      Alert.alert(
        t("friendsScreen.errorGeneric"),
        joinError instanceof Error ? joinError.message : t("common.tryAgain"),
      );
    } finally {
      setBusyActionKey(null);
    }
  }, [challengeId, t, token]);

  const isMember =
    typeof currentUserId === "number" &&
    (challenge?.members.some((member) => member.user_id === currentUserId) ?? false);

  return {
    challenge,
    loading,
    refreshing,
    error,
    busyActionKey,
    load,
    join,
    confirmCancel: () => confirmExit("cancel"),
    confirmLeave: () => confirmExit("leave"),
    isMember,
    isOwner: challenge?.owner_id === currentUserId,
    isActive: challenge?.status === "active",
    daysLeft: remainingChallengeDays(challenge),
    leaderMember: challengeLeader(challenge),
    totalSessions: totalChallengeSessions(challenge),
    outcomeLine: challengeOutcome(challenge, currentUserId, t),
    editOpen,
    closeEdit: () => setEditOpen(false),
    openEdit,
    editTitle,
    setEditTitle,
    editTarget,
    setEditTarget,
    editDuration,
    setEditDuration,
    editBusy,
    submitEdit,
  };
}
