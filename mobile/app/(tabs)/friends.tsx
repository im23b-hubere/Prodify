import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { type Href, useRouter } from "expo-router";
import { Activity, MessageCircle, Search, ThumbsUp, Trophy, UserPlus, Users } from "lucide-react-native";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { EmptyState } from "../../components/states/EmptyState";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { ApiError, apiJson } from "../../lib/client";
import { fetchEntitlement } from "../../lib/billing";
import { recordMomentumAction } from "../../lib/momentum";
import { formatTimeAgo } from "../../lib/timeAgo";
import {
  createChallenge,
  fetchBuddyStatus,
  fetchSessionReactionUsers,
  fetchChallenges,
  fetchCheckinStatus,
  fetchCommitment,
  fetchWeeklyRecap,
  toggleSessionReaction,
} from "../../lib/social";
import type {
  BuddyStatusDto,
  CheckinStatusDto,
  CommitmentDto,
  FriendActivityDto,
  FriendIncomingDto,
  FriendLeaderboardDto,
  SocialChallengeDto,
  SocialReactionUserDto,
  SocialRecapDto,
} from "../../types/friends";
import type { EntitlementDto } from "../../types/outcomes";

function rankColor(rank: number) {
  if (rank === 1) return "#fbbf24";
  if (rank === 2) return "#d1d5db";
  if (rank === 3) return "#cd7f32";
  return colors.secondary;
}

function formatDuration(sec: number, t: TFunction): string {
  const m = Math.floor(sec / 60);
  if (m < 1) return t("friendsScreen.durationUnderOne");
  if (m < 60) return t("friendsScreen.durationMin", { m });
  const h = Math.floor(m / 60);
  return t("friendsScreen.durationHours", { h, m: m % 60 });
}

function challengeKindLabel(kind: string, t: TFunction): string {
  if (kind === "duel") return t("friendsScreen.challengeKindDuel");
  if (kind === "team") return t("friendsScreen.challengeKindTeam");
  if (kind === "group") return t("friendsScreen.challengeKindGroup");
  return kind;
}

function challengeDaysLeft(weekStart: string, durationDays?: number): number | null {
  const start = new Date(weekStart);
  if (!Number.isFinite(start.getTime())) return null;
  const totalDays = Math.max(1, durationDays ?? 7);
  const end = new Date(start.getTime() + totalDays * 24 * 60 * 60 * 1000);
  const diffDays = Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

function sessionTypeSlugToCamelKey(slug: string): string {
  return slug
    .split("_")
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

function formatSessionTypeLabel(type: string, t: TFunction): string {
  const key = `sessionTypes.${sessionTypeSlugToCamelKey(type)}`;
  const label = t(key);
  if (label !== key) return label;
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function FriendsSectionHeader({
  title,
  subtitle,
  icon,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={friendsSectionStyles.headerRow}>
      {icon ? <View style={friendsSectionStyles.headerIconWrap}>{icon}</View> : null}
      <View style={friendsSectionStyles.headerTextCol}>
        <Text style={friendsSectionStyles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={friendsSectionStyles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={friendsSectionStyles.headerRight}>{right}</View> : null}
    </View>
  );
}

const friendsSectionStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  headerRight: { marginLeft: "auto", alignSelf: "center" },
  headerTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
    lineHeight: 22,
  },
  headerSubtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.body,
  },
});

export default function FriendsScreen() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"week" | "all">("week");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<FriendLeaderboardDto | null>(null);
  const [activity, setActivity] = useState<FriendActivityDto[]>([]);
  const [incoming, setIncoming] = useState<FriendIncomingDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [buddy, setBuddy] = useState<BuddyStatusDto | null>(null);
  const [checkin, setCheckin] = useState<CheckinStatusDto | null>(null);
  const [challenges, setChallenges] = useState<SocialChallengeDto[]>([]);
  const [commitment, setCommitment] = useState<CommitmentDto | null>(null);
  const [recap, setRecap] = useState<SocialRecapDto | null>(null);
  const [reactionUsersOpen, setReactionUsersOpen] = useState(false);
  const [reactionUsers, setReactionUsers] = useState<SocialReactionUserDto[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementDto | null>(null);
  const [upsellMessage, setUpsellMessage] = useState<string | null>(null);
  const [challengeCreateOpen, setChallengeCreateOpen] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeKind, setChallengeKind] = useState<"duel" | "team" | "group">("duel");
  const [challengeTarget, setChallengeTarget] = useState("5");
  const [challengeDuration, setChallengeDuration] = useState("7");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [challengeCreateBusy, setChallengeCreateBusy] = useState(false);
  const [triggerIndex, setTriggerIndex] = useState(0);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [reactionUsersLoading, setReactionUsersLoading] = useState(false);
  const [buddyPickerOpen, setBuddyPickerOpen] = useState(false);
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  const [goalTargetInput, setGoalTargetInput] = useState("5");
  const [goalDaysInput, setGoalDaysInput] = useState("7");
  const [goalSaving, setGoalSaving] = useState(false);
  const [sectionTab, setSectionTab] = useState<"overview" | "tools">("overview");
  const [feedMetricsBySession, setFeedMetricsBySession] = useState<
    Record<number, { reactionsCount: number; commentsCount: number; viewerReaction: string | null }>
  >({});
  const [reactionBusyBySession, setReactionBusyBySession] = useState<Record<number, boolean>>({});
  const loadSeq = useRef(0);
  const mounted = useRef(true);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadSeq.current += 1;
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, []);

  const periodParam = mode === "week" ? "week" : "all";
  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 1800);
  }, []);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    if (!token) {
      if (mounted.current) setLoading(false);
      return;
    }
    if (mounted.current) setError(null);
    try {
      const [board, feed, inc, buddyRes, checkinRes, challengesRes, commitmentRes, recapRes, ent] =
        await Promise.all([
          apiJson<FriendLeaderboardDto>(`/friends/leaderboard?period=${periodParam}`, { token }),
          apiJson<FriendActivityDto[]>("/friends/activity?limit=20", { token }),
          apiJson<FriendIncomingDto[]>("/friends/incoming", { token }),
          fetchBuddyStatus(token).catch(() => null),
          fetchCheckinStatus(token).catch(() => null),
          fetchChallenges(token).catch(() => []),
          fetchCommitment(token).catch(() => null),
          fetchWeeklyRecap(token).catch(() => null),
          fetchEntitlement(token).catch(() => null),
        ]);
      if (!mounted.current || seq !== loadSeq.current) return;
      setLeaderboard(board);
      setActivity(Array.isArray(feed) ? feed : []);
      setIncoming(Array.isArray(inc) ? inc : []);
      setBuddy(buddyRes);
      setCheckin(checkinRes);
      setChallenges(challengesRes);
      setCommitment(commitmentRes);
      setRecap(recapRes);
      setEntitlement(ent);
      const metricsSeed: Record<
        number,
        { reactionsCount: number; commentsCount: number; viewerReaction: string | null }
      > = {};
      for (const item of Array.isArray(feed) ? feed : []) {
        metricsSeed[item.session_id] = {
          reactionsCount: item.reactions_count ?? 0,
          commentsCount: item.comments_count ?? 0,
          viewerReaction: item.viewer_reaction ?? null,
        };
      }
      setFeedMetricsBySession(metricsSeed);
      const ch = await apiJson<{ challenge_id: number }>("/challenges/weekly/leaderboard", {
        token,
      }).catch(() => null);
      setChallengeId(typeof ch?.challenge_id === "number" ? ch.challenge_id : null);
      setUpsellMessage(null);
    } catch (e) {
      if (!mounted.current || seq !== loadSeq.current) return;
      setError(e instanceof Error ? e.message : t("friendsScreen.loadError"));
      setLeaderboard(null);
      setActivity([]);
      setIncoming([]);
      setBuddy(null);
      setCheckin(null);
      setChallenges([]);
      setCommitment(null);
      setRecap(null);
      setFeedMetricsBySession({});
      setEntitlement(null);
    } finally {
      if (!mounted.current || seq !== loadSeq.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, periodParam, t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().catch(() => undefined);
  }, [load]);

  async function sendRequest() {
    const u = addName.trim();
    if (u.length < 2) {
      Alert.alert(t("friendsScreen.alertUsername"), t("friendsScreen.alertUsernameInvalid"));
      return;
    }
    if (!token) return;
    setAddBusy(true);
    try {
      await apiJson("/friends/request", { token, method: "POST", body: { username: u } });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddName("");
      setAddOpen(false);
      await load();
      Alert.alert(
        t("friendsScreen.requestSentTitle"),
        t("friendsScreen.requestSentBody", { name: u }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("friendsScreen.couldNotSend");
      Alert.alert(t("friendsScreen.couldNotSend"), msg);
    } finally {
      setAddBusy(false);
    }
  }

  async function acceptRequest(id: number) {
    if (!token) return;
    setActionBusy(id);
    try {
      await apiJson(`/friends/${id}/accept`, { token, method: "POST" });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const actions = await apiJson<{ key: string; title: string; cta_label: string }[]>(
        `/friends/${id}/post-accept-actions`,
        { token },
      ).catch(() => []);
      await load();
      if (actions.length > 0) {
        Alert.alert(
          t("friendsScreen.requestAcceptedTitle"),
          t("friendsScreen.requestAcceptedBody", {
            actions: actions.map((a) => `• ${a.title}`).join("\n"),
          }),
        );
      }
    } catch (e) {
      Alert.alert(
        t("friendsScreen.errorGeneric"),
        e instanceof Error ? e.message : t("friendsScreen.acceptFailed"),
      );
    } finally {
      setActionBusy(null);
    }
  }

  async function declineRequest(id: number) {
    if (!token) return;
    setActionBusy(id);
    try {
      await apiJson(`/friends/${id}`, { token, method: "DELETE" });
      await load();
    } catch (e) {
      Alert.alert(
        t("friendsScreen.errorGeneric"),
        e instanceof Error ? e.message : t("friendsScreen.declineFailed"),
      );
    } finally {
      setActionBusy(null);
    }
  }

  const entries = leaderboard?.entries ?? [];
  const hasOtherFriends = entries.some((entry) => entry.user_id !== user?.id);
  const friendCandidates = entries.filter((entry) => entry.user_id !== user?.id);

  async function joinChallenge() {
    if (!token) return;
    if (!challengeId) {
      Alert.alert(t("friendsScreen.errorGeneric"), t("friendsScreen.noChallengesYet"));
      setChallengeCreateOpen(true);
      return;
    }
    setBusyActionKey("join_challenge");
    try {
      await apiJson("/social/challenges/join", {
        token,
        method: "POST",
        body: { challenge_id: challengeId },
      });
      await load();
      if (user?.id) {
        await recordMomentumAction(user.id, "challenge");
      }
      showToast(t("friendsScreen.toastPressure"));
      setUpsellMessage(t("friendsScreen.upsellInviteFriend"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      if (e instanceof ApiError && e.status === 402) {
        setUpsellMessage(msg);
      }
      Alert.alert(t("friendsScreen.errorGeneric"), msg);
    } finally {
      setBusyActionKey(null);
    }
  }

  async function submitShipCheckin() {
    if (!token) return;
    setBusyActionKey("ship_checkin");
    try {
      await apiJson("/social/checkins/done", {
        token,
        method: "POST",
        body: { note: "Shipped this week." },
      });
      await load();
      showToast(t("friendsScreen.toastMomentum"));
    } catch (e) {
      Alert.alert(
        t("friendsScreen.errorGeneric"),
        e instanceof Error ? e.message : t("common.tryAgain"),
      );
    } finally {
      setBusyActionKey(null);
    }
  }

  async function inviteBuddy(friendUserId: number) {
    if (!token) return;
    if (!friendCandidates.some((entry) => entry.user_id === friendUserId)) {
      Alert.alert(t("friendsScreen.errorGeneric"), t("friendsScreen.feedEmptyMessage"));
      setAddOpen(true);
      return;
    }
    setBusyActionKey("buddy_invite");
    try {
      await apiJson("/social/buddy/invite", {
        token,
        method: "POST",
        body: { friend_user_id: friendUserId },
      });
      await load();
      showToast(t("friendsScreen.toastSocialEngaged"));
      setBuddyPickerOpen(false);
    } catch (e) {
      Alert.alert(
        t("friendsScreen.errorGeneric"),
        e instanceof Error ? e.message : t("common.tryAgain"),
      );
    } finally {
      setBusyActionKey(null);
    }
  }

  function openGoalEditor() {
    setGoalTargetInput(String(Math.max(1, commitment?.target_sessions ?? 5)));
    setGoalDaysInput(String(Math.max(3, commitment?.period_days ?? 7)));
    setGoalEditorOpen(true);
  }

  async function saveCommitmentTarget() {
    if (!token) return;
    const target = Number.parseInt(goalTargetInput, 10);
    const periodDays = Number.parseInt(goalDaysInput, 10);
    if (!Number.isFinite(target) || target < 1 || target > 50) {
      Alert.alert(t("friendsScreen.couldNotSetGoal"), t("friendsScreen.invalidChallengeBody"));
      return;
    }
    if (!Number.isFinite(periodDays) || periodDays < 3 || periodDays > 30) {
      Alert.alert(t("friendsScreen.couldNotSetGoal"), t("friendsScreen.invalidChallengeBody"));
      return;
    }
    setGoalSaving(true);
    try {
      await apiJson("/social/commitment", {
        token,
        method: "POST",
        body: {
          target_sessions: target,
          visibility: "friends",
          commitment_key: "sessions",
          period_days: periodDays,
        },
      });
      await load();
      setGoalEditorOpen(false);
      showToast(t("friendsScreen.toastExtraGoal"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      if (msg.toLowerCase().includes("premium")) {
        setUpsellMessage(msg);
      }
      Alert.alert(t("friendsScreen.couldNotSetGoal"), msg);
    } finally {
      setGoalSaving(false);
    }
  }

  async function submitCreateChallenge() {
    if (!token) return;
    const title = challengeTitle.trim();
    const target = Number.parseInt(challengeTarget, 10);
    const durationDays = Number.parseInt(challengeDuration, 10);
    if (
      title.length < 3 ||
      !Number.isFinite(target) ||
      target < 1 ||
      !Number.isFinite(durationDays) ||
      durationDays < 3
    ) {
      Alert.alert(
        t("friendsScreen.invalidChallengeTitle"),
        t("friendsScreen.invalidChallengeBody"),
      );
      return;
    }
    setChallengeCreateBusy(true);
    try {
      const memberIds = selectedMembers.filter((id) => id !== user?.id);
      await createChallenge(token, {
        challenge_kind: challengeKind,
        title,
        target_sessions: target,
        duration_days: durationDays,
        member_user_ids: memberIds,
      });
      setChallengeCreateOpen(false);
      setChallengeTitle("");
      setChallengeTarget("5");
      setChallengeDuration("7");
      setSelectedMembers([]);
      await load();
      if (user?.id) {
        await recordMomentumAction(user.id, "challenge");
      }
      showToast(t("friendsScreen.toastChallengeLive"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      if (msg.toLowerCase().includes("upgrade")) {
        setUpsellMessage(msg);
      }
      Alert.alert(t("friendsScreen.couldNotCreateChallenge"), msg);
    } finally {
      setChallengeCreateBusy(false);
    }
  }

  async function openReactionUsers(sessionId: number) {
    if (!token) return;
    setReactionUsersOpen(true);
    setReactionUsersLoading(true);
    try {
      const rows = await fetchSessionReactionUsers(token, sessionId);
      setReactionUsers(rows);
    } catch (e) {
      setReactionUsers([]);
      Alert.alert(
        t("friendsScreen.errorGeneric"),
        e instanceof Error ? e.message : t("common.tryAgain"),
      );
    } finally {
      setReactionUsersLoading(false);
    }
  }

  async function toggleThumbReaction(item: FriendActivityDto) {
    if (!token || reactionBusyBySession[item.session_id]) return;
    const sessionId = item.session_id;
    const previous = feedMetricsBySession[sessionId] ?? {
      reactionsCount: item.reactions_count ?? 0,
      commentsCount: item.comments_count ?? 0,
      viewerReaction: item.viewer_reaction ?? null,
    };
    const hadThumb = previous.viewerReaction === "👍";
    const optimistic = {
      ...previous,
      viewerReaction: hadThumb ? null : "👍",
      reactionsCount: Math.max(0, previous.reactionsCount + (hadThumb ? -1 : 1)),
    };
    setFeedMetricsBySession((prev) => ({ ...prev, [sessionId]: optimistic }));
    setReactionBusyBySession((prev) => ({ ...prev, [sessionId]: true }));
    try {
      const updated = await toggleSessionReaction(token, sessionId, "👍");
      const updatedCount = updated.reduce((sum, row) => sum + row.count, 0);
      const mine = updated.find((row) => row.emoji === "👍" && row.reacted_by_me);
      setFeedMetricsBySession((prev) => ({
        ...prev,
        [sessionId]: {
          reactionsCount: updatedCount,
          commentsCount: prev[sessionId]?.commentsCount ?? previous.commentsCount,
          viewerReaction: mine ? "👍" : null,
        },
      }));
    } catch (e) {
      setFeedMetricsBySession((prev) => ({ ...prev, [sessionId]: previous }));
      Alert.alert(
        t("friendsScreen.errorGeneric"),
        e instanceof Error ? e.message : t("common.tryAgain"),
      );
    } finally {
      setReactionBusyBySession((prev) => ({ ...prev, [sessionId]: false }));
    }
  }

  async function acceptBuddyInvite(inviteId: number) {
    if (!token) return;
    setBusyActionKey("buddy_accept");
    try {
      await apiJson("/social/buddy/accept", {
        token,
        method: "POST",
        body: { invite_id: inviteId },
      });
      await load();
      showToast(t("friendsScreen.toastCollaborativeMove"));
    } catch (e) {
      Alert.alert(
        t("friendsScreen.errorGeneric"),
        e instanceof Error ? e.message : t("common.tryAgain"),
      );
    } finally {
      setBusyActionKey(null);
    }
  }

  const challengeCards = useMemo(() => challenges.slice(0, 5), [challenges]);
  const triggerCards = useMemo(() => {
    const cards: { key: string; title: string; actionLabel: string; onPress: () => void }[] = [];
    if (
      buddy?.status === "active" &&
      (buddy.buddy_week_sessions ?? 0) > (buddy.this_week_sessions ?? 0)
    ) {
      cards.push({
        key: "buddy_completed",
        title: t("friendsScreen.triggerBuddyStarted"),
        actionLabel: t("friendsScreen.triggerStartProducing"),
        onPress: () => {
          if (!token) return;
          apiJson("/sessions/quick-start", {
            token,
            method: "POST",
            body: { session_type: "beat_making" },
          })
            .then(async () => {
              if (user?.id) {
                await recordMomentumAction(user.id, "session");
              }
              showToast(t("friendsScreen.toastLockedIn"));
            })
                            .catch((e: unknown) => {
                              Alert.alert(
                                t("friendsScreen.errorGeneric"),
                                e instanceof Error ? e.message : t("common.tryAgain"),
                              );
                            });
        },
      });
    }
    const closeBattle = challengeCards.find((c) => {
      const mine = c.members.find((m) => m.user_id === user?.id);
      const lead = Math.max(...c.members.map((m) => m.progress_sessions), 0);
      return mine && lead - mine.progress_sessions <= 1 && lead - mine.progress_sessions > 0;
    });
    if (closeBattle) {
      cards.push({
        key: "close_battle",
        title: t("friendsScreen.triggerCloseBattle"),
        actionLabel: t("friendsScreen.triggerComment"),
        onPress: () => {
          if (user?.id) {
            void recordMomentumAction(user.id, "social");
          }
          if (activity[0]) {
            router.push({
              pathname: "/session/[id]",
              params: {
                id: String(activity[0].session_id),
                ownerName: activity[0].username,
              },
            } as Href);
          }
        },
      });
    }
    if (buddy?.status === "active" && buddy.buddy_user_id) {
      cards.push({
        key: "streak_risk",
        title: t("friendsScreen.triggerBuddyRisk"),
        actionLabel: t("friendsScreen.triggerKeepAlive"),
        onPress: () => {
          if (!token) return;
          apiJson("/social/streak/rescue", {
            token,
            method: "POST",
            body: { rescued_user_id: buddy.buddy_user_id },
          })
            .then(async () => {
              if (user?.id) {
                await recordMomentumAction(user.id, "rescue");
              }
              showToast(t("friendsScreen.toastCollaborativeMove"));
              return load();
            })
                            .catch((e: unknown) => {
                              Alert.alert(
                                t("friendsScreen.errorGeneric"),
                                e instanceof Error ? e.message : t("common.tryAgain"),
                              );
                            });
        },
      });
    }
    return cards;
  }, [buddy, challengeCards, user?.id, token, activity, showToast, load, router, t]);

  const activeTriggerCard = triggerCards[triggerIndex] ?? null;

  function completeTriggerAction() {
    setTriggerIndex((prev) => (prev + 1 < triggerCards.length ? prev + 1 : prev));
  }

  const modeOptions = [
    { key: "week" as const, label: t("friendsScreen.modeWeek") },
    { key: "all" as const, label: t("friendsScreen.modeAll") },
  ];

  useEffect(() => {
    setTriggerIndex(0);
  }, [triggerCards.length]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.topBar}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{t("friendsScreen.title")}</Text>
            <Text style={styles.screenSubtitle}>{t("friendsScreen.subtitle")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendsScreen.addFriendA11y")}
            style={styles.iconButton}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              setAddOpen(true);
            }}
          >
            <Search color={colors.textPrimary} size={18} />
          </Pressable>
        </View>
        <View style={styles.screenSegmentedRow}>
          <Pressable
            style={[
              styles.screenSegmentChip,
              sectionTab === "overview" && styles.screenSegmentChipActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: sectionTab === "overview" }}
            accessibilityLabel={t("friendsScreen.tabOverview")}
            onPress={() => setSectionTab("overview")}
          >
            <Text
              style={[
                styles.screenSegmentText,
                sectionTab === "overview" && styles.screenSegmentTextActive,
              ]}
            >
              {t("friendsScreen.tabOverview")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.screenSegmentChip, sectionTab === "tools" && styles.screenSegmentChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: sectionTab === "tools" }}
            accessibilityLabel={t("friendsScreen.tabSocialTools")}
            onPress={() => setSectionTab("tools")}
          >
            <Text
              style={[styles.screenSegmentText, sectionTab === "tools" && styles.screenSegmentTextActive]}
            >
              {t("friendsScreen.tabSocialTools")}
            </Text>
          </Pressable>
        </View>
        {!loading && !hasOtherFriends ? (
          <View style={styles.emptyFriendsCard}>
            <View style={styles.emptyFriendsIcon}>
              <UserPlus color={colors.primary} size={18} />
            </View>
            <View style={styles.emptyFriendsCopy}>
              <Text style={styles.emptyFriendsTitle}>{t("friendsScreen.feedEmptyTitle")}</Text>
              <Text style={styles.userMeta}>{t("friendsScreen.feedEmptyMessage")}</Text>
            </View>
            <PrimaryButton label={t("friendsScreen.feedEmptyCta")} onPress={() => setAddOpen(true)} />
          </View>
        ) : null}
        {entitlement?.entitlement !== "premium" && upsellMessage ? (
          <View style={styles.upsellCard}>
            <Text style={styles.upsellTitle}>{t("friendsScreen.premiumBoost")}</Text>
            <Text style={styles.userMeta}>{upsellMessage}</Text>
            <PrimaryButton
              label={t("friendsScreen.unlockPremiumCta")}
              onPress={() => router.push("/paywall")}
            />
          </View>
        ) : null}

        {error ? (
          <ErrorState
            title={t("common.oops")}
            message={error}
            retryLabel={t("common.tryAgain")}
            onRetry={() => load().catch(() => undefined)}
          />
        ) : null}

        {loading && !refreshing && !error ? (
          <LoadingState message={t("friendsScreen.loading")} />
        ) : null}

        {!(loading && !refreshing) && !error ? (
          <>
            {incoming.length > 0 ? (
              <View style={styles.sectionWrap}>
                <FriendsSectionHeader
                  title={
                    incoming.length > 1
                      ? t("friendsScreen.incomingTitleCount", { count: incoming.length })
                      : t("friendsScreen.incomingTitle")
                  }
                  subtitle={t("friendsScreen.incomingSectionSub")}
                />
                <View style={styles.incomingList}>
                  {incoming.map((req) => (
                    <View key={req.id} style={styles.incomingRow}>
                      <View style={styles.incomingCopy}>
                        <Text style={styles.incomingName}>{req.username}</Text>
                        <Text style={styles.incomingHint}>{t("friendsScreen.incomingHint")}</Text>
                      </View>
                      <View style={styles.incomingActions}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.smallBtn,
                            styles.acceptBtn,
                            pressed && { opacity: 0.9 },
                          ]}
                          disabled={actionBusy === req.id}
                          onPress={() => acceptRequest(req.id)}
                        >
                          <Text style={styles.smallBtnText}>{t("friendsScreen.accept")}</Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.smallBtn,
                            styles.declineBtn,
                            pressed && { opacity: 0.9 },
                          ]}
                          disabled={actionBusy === req.id}
                          onPress={() => declineRequest(req.id)}
                        >
                          <Text style={styles.smallBtnTextDim}>{t("friendsScreen.decline")}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {sectionTab === "tools" ? (
            <View style={styles.sectionWrap}>
              <FriendsSectionHeader
                icon={<Users color={colors.primary} size={20} />}
                title={t("friendsScreen.sectionChallengesTitle")}
                subtitle={t("friendsScreen.sectionChallengesSub")}
              />
              <View style={styles.cardElevated}>
                <PrimaryButton
                  label={
                    busyActionKey === "join_challenge"
                      ? t("friendsScreen.loading")
                      : t("friendsScreen.joinCreativeChallenge")
                  }
                  onPress={() => void joinChallenge()}
                  disabled={busyActionKey === "join_challenge"}
                />
                <Text style={styles.sectionHintText}>{t("friendsScreen.challengeQuickActionsHint")}</Text>
                <View style={styles.challengeSecondaryRow}>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      styles.secondaryBtnHalf,
                      pressed && { opacity: 0.88 },
                    ]}
                    onPress={() => void submitShipCheckin()}
                    disabled={busyActionKey === "ship_checkin"}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {busyActionKey === "ship_checkin"
                        ? t("friendsScreen.loading")
                        : t("friendsScreen.checkInNow")}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      styles.secondaryBtnHalf,
                      pressed && { opacity: 0.88 },
                    ]}
                    onPress={() => setChallengeCreateOpen(true)}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {t("friendsScreen.createCreativeChallenge")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
            ) : null}

            {sectionTab === "tools" ? (
            <View style={styles.sectionWrap}>
              <FriendsSectionHeader
                title={t("friendsScreen.sectionCircleTitle")}
                subtitle={t("friendsScreen.sectionCircleSub")}
              />
              <View style={styles.cardElevated}>
                <View style={styles.innerPanel}>
                  <Text style={styles.innerHeading}>{t("friendsScreen.buddyConnection")}</Text>
                  <Text style={styles.helperText}>{t("friendsScreen.buddyHelper")}</Text>
                  <Text style={styles.userMeta}>
                    {buddy?.status === "active"
                      ? t("friendsScreen.buddyActive", {
                          buddy: buddy.buddy_username,
                          buddyWeek: buddy.buddy_week_sessions ?? 0,
                          yourWeek: buddy.this_week_sessions ?? 0,
                        })
                      : buddy?.status === "pending_incoming"
                        ? t("friendsScreen.buddyPendingIncoming", {
                            buddy: buddy.buddy_username ?? "buddy",
                          })
                        : buddy?.status === "pending_outgoing"
                          ? t("friendsScreen.buddyPendingOutgoing", {
                              buddy: buddy.buddy_username ?? "buddy",
                            })
                          : t("friendsScreen.buddyPickOne")}
                  </Text>
                  {entitlement?.entitlement === "premium" ? (
                    <Text style={styles.premiumPill}>{t("friendsScreen.premiumActive")}</Text>
                  ) : null}
                  {buddy?.status === "none" ? (
                    <PrimaryButton
                      label={
                        busyActionKey === "buddy_invite"
                          ? t("friendsScreen.loading")
                          : t("friendsScreen.inviteBuddy")
                      }
                      onPress={() => setBuddyPickerOpen(true)}
                      disabled={busyActionKey === "buddy_invite" || !hasOtherFriends}
                    />
                  ) : null}
                  {buddy?.status === "pending_incoming" && buddy.invite_id ? (
                    <PrimaryButton
                      label={
                        busyActionKey === "buddy_accept"
                          ? t("friendsScreen.loading")
                          : t("friendsScreen.acceptBuddyInvite")
                      }
                      onPress={() => void acceptBuddyInvite(buddy.invite_id)}
                      disabled={busyActionKey === "buddy_accept"}
                    />
                  ) : null}
                </View>

                <View style={styles.innerDivider} />

                <View style={styles.innerPanel}>
                  <Text style={styles.innerHeading}>{t("friendsScreen.studioActivity")}</Text>
                  <Text style={styles.helperText}>{t("friendsScreen.checkinHelper")}</Text>
                  <Text style={styles.userMeta}>
                    {checkin
                      ? t("friendsScreen.checkinStatus", {
                          done: checkin.done_count,
                          target: checkin.target_checkins,
                          state: checkin.on_track
                            ? t("friendsScreen.checkinInFlow")
                            : t("friendsScreen.checkinNeedsPush"),
                        })
                      : t("friendsScreen.checkinHint")}
                  </Text>
                  {checkin?.day_states?.length ? (
                    <View style={styles.dayStateRow}>
                      {checkin.day_states.map((day) => (
                        <View
                          key={day.day_key}
                          style={[
                            styles.dayStatePill,
                            day.state === "done"
                              ? styles.dayStateDone
                              : day.state === "missed"
                                ? styles.dayStateMissed
                                : styles.dayStateOpen,
                          ]}
                        >
                          <Text style={styles.dayStateText}>
                            {new Date(day.day_key).toLocaleDateString(undefined, {
                              weekday: "short",
                            })}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                <View style={styles.innerDivider} />

                <View style={styles.innerPanel}>
                  <Text style={styles.innerHeading}>{t("friendsScreen.creativeGoal")}</Text>
                  <Text style={styles.helperText}>{t("friendsScreen.goalHelper")}</Text>
                  <Text style={styles.userMeta}>
                    {commitment
                      ? t("friendsScreen.commitmentStatus", {
                          current: commitment.current_sessions,
                          target: commitment.target_sessions,
                          status: commitment.status,
                        })
                      : t("friendsScreen.commitmentHint")}
                  </Text>
                  <PrimaryButton
                    label={t("friendsScreen.editGoal")}
                    onPress={openGoalEditor}
                  />
                  {commitment?.status === "completed" ? (
                    <Text style={styles.upsellHint}>{t("friendsScreen.upsellInviteFriend")}</Text>
                  ) : null}
                  {commitment?.upsell_hint && entitlement?.entitlement !== "premium" ? (
                    <Text style={styles.upsellHint}>{commitment.upsell_hint}</Text>
                  ) : null}
                </View>
              </View>
            </View>
            ) : null}

            {sectionTab === "overview" ? (
            <View style={styles.sectionWrap}>
              <FriendsSectionHeader
                icon={<Trophy color={colors.primary} size={20} />}
                title={t("friendsScreen.sectionLeaderboardTitle")}
                subtitle={t("friendsScreen.sectionLeaderboardSub")}
                right={
                  <View style={styles.periodToggle}>
                    {modeOptions.map((item) => (
                      <Pressable
                        key={item.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: mode === item.key }}
                        style={[
                          styles.periodChip,
                          mode === item.key && styles.periodChipActive,
                        ]}
                        onPress={() => setMode(item.key)}
                      >
                        <Text
                          style={[
                            styles.periodChipText,
                            mode === item.key && styles.periodChipTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                }
              />
              <View style={styles.cardElevated}>
                {!loading && entries.length === 1 && user?.id === entries[0]?.user_id ? (
                  <Text style={styles.emptyLeader}>{t("friendsScreen.soloLeader")}</Text>
                ) : null}
                {entries.map((entry, idx) => (
                  <Animated.View
                    key={`${entry.user_id}-${entry.rank}`}
                    entering={FadeInDown.delay(idx * 35).duration(320)}
                  >
                    <Pressable
                      style={[styles.leaderItem, idx > 0 && styles.leaderDivider]}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => undefined);
                        router.push(`/profile/${entry.user_id}`);
                      }}
                    >
                      <View style={[styles.rankBadge, { backgroundColor: rankColor(entry.rank) }]}>
                        <Text style={styles.rankText}>#{entry.rank}</Text>
                      </View>
                      {entry.profile_picture_url ? (
                        <Image source={{ uri: entry.profile_picture_url }} style={styles.avatarImage} />
                      ) : (
                        <View style={styles.avatar}>
                          <Text style={styles.avatarLabel}>
                            {entry.username.slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.userCopy}>
                        <View style={styles.nameRow}>
                          <Text style={styles.userName}>{entry.username}</Text>
                          {entry.is_premium ? <Text style={styles.premiumTag}>PRO</Text> : null}
                          {user?.id === entry.user_id ? (
                            <View style={styles.youPill}>
                              <Text style={styles.youPillText}>{t("friendsScreen.youPill")}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.userMeta}>
                          {mode === "week"
                            ? t("friendsScreen.metaWeek", {
                                sessions: entry.sessions_in_period,
                                days: entry.current_streak_days,
                              })
                            : t("friendsScreen.metaAll", {
                                sessions: entry.sessions_in_period,
                                days: entry.current_streak_days,
                              })}
                        </Text>
                        <Text style={styles.userMeta}>
                          {entry.trend === "up"
                            ? t("friendsScreen.trendUp")
                            : entry.trend === "down"
                              ? t("friendsScreen.trendDown")
                              : t("friendsScreen.trendStable")}{" "}
                          ·{" "}
                          {entry.is_chasing_you
                            ? t("friendsScreen.statusChasingYou")
                            : entry.is_threatening_you
                              ? t("friendsScreen.statusCloseBehind")
                              : t("friendsScreen.statusDelta", {
                                  sign: (entry.sessions_delta_vs_prior ?? 0) >= 0 ? "+" : "",
                                  delta: entry.sessions_delta_vs_prior ?? 0,
                                })}
                        </Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            </View>
            ) : null}

            {sectionTab === "overview" ? (
            <View style={styles.sectionWrap}>
              <FriendsSectionHeader
                icon={<Activity color={colors.primary} size={20} />}
                title={t("friendsScreen.sectionActivityTitle")}
                subtitle={t("friendsScreen.sectionActivitySub")}
                right={
                  activity.length > 0 ? (
                    <View style={styles.activityCountPill}>
                      <Text style={styles.activityCountText}>{activity.length}</Text>
                    </View>
                  ) : null
                }
              />
              {activeTriggerCard ? (
                <View style={styles.cardElevated}>
                  <View key={activeTriggerCard.key} style={styles.triggerCardPrimary}>
                    <Text style={styles.userName}>{activeTriggerCard.title}</Text>
                    <Pressable
                      style={styles.triggerActionPrimary}
                      onPress={() => {
                        activeTriggerCard.onPress();
                        completeTriggerAction();
                      }}
                    >
                      <Text style={styles.triggerActionTextPrimary}>
                        {activeTriggerCard.actionLabel}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              <View style={styles.activityFeedStack}>
                {activity.length === 0 && !loading ? (
                  <EmptyState
                    icon="🎛️"
                    title={t("friendsScreen.feedEmptyTitle")}
                    message={t("friendsScreen.feedEmptyMessage")}
                    actionLabel={t("friendsScreen.feedEmptyCta")}
                    onAction={() => {
                      Haptics.selectionAsync().catch(() => undefined);
                      setAddOpen(true);
                    }}
                  />
                ) : null}
                {activity.map((item, idx) => {
                  const metrics = feedMetricsBySession[item.session_id];
                  const reactionTotal = metrics?.reactionsCount ?? item.reactions_count ?? 0;
                  const commentCount = metrics?.commentsCount ?? item.comments_count ?? 0;
                  const reactedByMe = metrics?.viewerReaction === "👍";
                  const typeLabel = formatSessionTypeLabel(item.session_type, t);
                  return (
                    <Animated.View
                      key={item.session_id}
                      entering={FadeInDown.delay(Math.min(idx, 8) * 40).duration(280)}
                      style={styles.feedItemCard}
                    >
                      <View style={styles.feedItemAccent} />
                      <View style={styles.feedItemInner}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t("friendsScreen.activityOpenSessionA11y", {
                            name: item.username,
                          })}
                          style={styles.feedHeaderRow}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => undefined);
                            router.push({
                              pathname: "/session/[id]",
                              params: {
                                id: String(item.session_id),
                                ownerName: item.username,
                              },
                            } as Href);
                          }}
                        >
                          {item.profile_picture_url ? (
                            <Image source={{ uri: item.profile_picture_url }} style={styles.feedAvatarImage} />
                          ) : (
                            <View style={styles.feedAvatar}>
                              <Text style={styles.feedAvatarText}>
                                {item.username.slice(0, 2).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={styles.feedHeaderCopy}>
                            <View style={styles.feedNameRow}>
                              <Text
                                style={[styles.feedUserName, styles.feedUserNameFlex]}
                                numberOfLines={1}
                              >
                                {item.username}
                              </Text>
                              {user?.id === item.user_id ? (
                                <View style={styles.feedYouPill}>
                                  <Text style={styles.feedYouPillText}>{t("friendsScreen.youPill")}</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.feedSessionMeta} numberOfLines={2}>
                              {item.status === "live"
                                ? t("friendsScreen.feedSessionMetaLive", {
                                    type: typeLabel,
                                    ago: formatTimeAgo(item.activity_at, t),
                                  })
                                : t("friendsScreen.feedSessionMeta", {
                                    type: typeLabel,
                                    duration: formatDuration(item.duration_seconds ?? 0, t),
                                    ago: formatTimeAgo(item.activity_at, t),
                                  })}
                            </Text>
                          </View>
                        </Pressable>

                        <View style={styles.feedActionsRow}>
                          <Pressable
                            accessibilityRole="button"
                            style={({ pressed }) => [
                              styles.feedReactPrimaryChip,
                              reactedByMe && styles.feedReactPrimaryChipActive,
                              pressed && { opacity: 0.88 },
                            ]}
                            disabled={reactionBusyBySession[item.session_id]}
                            onPress={() => void toggleThumbReaction(item)}
                          >
                            <ThumbsUp
                              color={reactedByMe ? colors.textPrimary : colors.textSecondary}
                              size={16}
                              strokeWidth={2}
                            />
                            <Text
                              style={[
                                styles.feedReactPrimaryChipText,
                                reactedByMe && styles.feedReactPrimaryChipTextActive,
                              ]}
                            >
                              {reactedByMe
                                ? t("friendsScreen.reactedShort")
                                : t("friendsScreen.reactShort")}
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("friendsScreen.activityReactionsA11y", {
                              count: reactionTotal,
                            })}
                            style={({ pressed }) => [
                              styles.feedActionChip,
                              pressed && styles.feedActionChipPressed,
                            ]}
                            onPress={() => void openReactionUsers(item.session_id)}
                          >
                            <ThumbsUp color={colors.textSecondary} size={16} strokeWidth={2} />
                            <Text style={styles.feedActionChipText}>
                              {t("friendsScreen.reactionsCount", { count: reactionTotal })}
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("friendsScreen.activityCommentsA11y", {
                              count: commentCount,
                            })}
                            style={({ pressed }) => [
                              styles.feedActionChip,
                              pressed && styles.feedActionChipPressed,
                            ]}
                            onPress={() =>
                              router.push({
                                pathname: "/session/[id]",
                                params: {
                                  id: String(item.session_id),
                                  ownerName: item.username,
                                },
                              } as Href)
                            }
                          >
                            <MessageCircle color={colors.textSecondary} size={16} strokeWidth={2} />
                            <Text style={styles.feedActionChipText}>
                              {t("friendsScreen.commentsCount", { count: commentCount })}
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            style={({ pressed }) => [styles.feedReplyChip, pressed && { opacity: 0.88 }]}
                            onPress={() =>
                              router.push({
                                pathname: "/session/[id]",
                                params: {
                                  id: String(item.session_id),
                                  ownerName: item.username,
                                },
                              } as Href)
                            }
                          >
                            <Text style={styles.feedReplyChipText}>
                              {t("friendsScreen.openSessionComments")}
                            </Text>
                          </Pressable>
                        </View>

                        <Pressable
                          accessibilityRole="button"
                          style={({ pressed }) => [styles.feedThreadLink, pressed && { opacity: 0.85 }]}
                          onPress={() =>
                            router.push({
                              pathname: "/session/[id]",
                              params: {
                                id: String(item.session_id),
                                ownerName: item.username,
                              },
                            } as Href)
                          }
                        >
                          <Text style={styles.viewAllComments}>
                            {commentCount > 0
                              ? t("friendsScreen.viewCommentsCount", { count: commentCount })
                              : t("friendsScreen.beFirstToComment")}
                          </Text>
                        </Pressable>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
            ) : null}

            {sectionTab === "tools" ? (
            <View style={styles.sectionWrap}>
              <FriendsSectionHeader
                title={t("friendsScreen.socialChallenges")}
                subtitle={t("friendsScreen.sectionSocialChallengesSub")}
              />
              <View style={styles.cardElevated}>
                {challengeCards.length === 0 ? (
                  <>
                    <Text style={styles.feedEmpty}>{t("friendsScreen.noChallengesYet")}</Text>
                    <Text style={styles.sectionHintText}>{t("friendsScreen.challengeEmptyHint")}</Text>
                    <PrimaryButton
                      label={t("friendsScreen.startFirstChallenge")}
                      onPress={() => setChallengeCreateOpen(true)}
                    />
                  </>
                ) : null}
                {challengeCards.map((challenge) => (
                  <View key={challenge.id} style={styles.challengeBlock}>
                    <View style={styles.challengeHeaderRow}>
                      <Text style={styles.userName}>{challenge.title}</Text>
                      <View style={styles.challengeKindPill}>
                        <Text style={styles.challengeKindPillText}>
                          {challengeKindLabel(challenge.challenge_kind, t)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.userMeta}>
                      {t("friendsScreen.challengeGoalLine", {
                        target: challenge.target_sessions,
                        days:
                          challengeDaysLeft(challenge.week_start, challenge.duration_days) ??
                          challenge.duration_days ??
                          7,
                      })}
                    </Text>
                    {challenge.members.map((m) => {
                      const pct = Math.max(
                        0,
                        Math.min(
                          100,
                          Math.round((m.progress_sessions / challenge.target_sessions) * 100),
                        ),
                      );
                      const me = m.user_id === user?.id;
                      const leader = Math.max(...challenge.members.map((x) => x.progress_sessions));
                      const label =
                        m.progress_sessions === leader
                          ? t("friendsScreen.challengeLabelTone")
                          : leader - m.progress_sessions <= 1
                            ? t("friendsScreen.challengeLabelCloseBattle")
                            : t("friendsScreen.challengeLabelKeepGoing");
                      return (
                        <View key={`${challenge.id}-${m.user_id}`} style={styles.challengeMemberRow}>
                          <View style={styles.challengeMemberHeader}>
                            <Text style={[styles.userMeta, me && styles.challengeMe]}>{m.username}</Text>
                            <Text style={[styles.userMeta, me && styles.challengeMe]}>
                              {m.progress_sessions}/{challenge.target_sessions}
                            </Text>
                          </View>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${pct}%` }]} />
                          </View>
                          <Text style={styles.challengeMemberLabel}>{label}</Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
            ) : null}

            {sectionTab === "tools" ? (
            <View style={styles.sectionWrap}>
              <FriendsSectionHeader
                title={t("friendsScreen.weeklySocialRecap")}
                subtitle={t("friendsScreen.sectionRecapSub")}
              />
              <View style={styles.cardElevated}>
                <Text style={styles.userMeta}>
                  {recap
                    ? recap.has_active_buddy
                      ? t("friendsScreen.recapWithBuddy", {
                          your: recap.your_sessions,
                          buddy: recap.buddy_sessions,
                        })
                      : t("friendsScreen.recapSolo", {
                          your: recap.your_sessions,
                        })
                    : t("friendsScreen.noRecapYet")}
                </Text>
                {recap?.identity_tag ? (
                  <Text style={styles.identityLine}>
                    {t(`friendsScreen.identityTag.${recap.identity_tag}`)}
                  </Text>
                ) : null}
                {recap ? (
                  <Text style={styles.userMeta}>
                    {t("friendsScreen.recapTeamLine", { count: recap.team_sessions })} ·{" "}
                    {t("friendsScreen.recapWowLine", {
                      sign: recap.wow_delta_sessions >= 0 ? "+" : "",
                      delta: recap.wow_delta_sessions,
                    })}
                  </Text>
                ) : null}
                {recap?.premium_detail_locked ? (
                  <Text style={styles.upsellHint}>
                    {recap.upsell_hint ?? t("friendsScreen.unlockPremiumInsights")}
                  </Text>
                ) : null}
              </View>
            </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {toastMessage ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}

      <Modal
        visible={reactionUsersOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setReactionUsersOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setReactionUsersOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("friendsScreen.reactionsTitle")}</Text>
            {(reactionUsersLoading
              ? [
                  {
                    username: t("friendsScreen.loading"),
                    emoji: "",
                    user_id: -1,
                    created_at: "loading",
                  },
                ]
              : reactionUsers.length === 0
              ? [
                  {
                    username: t("friendsScreen.noReactionsYet"),
                    emoji: "",
                    user_id: -1,
                    created_at: "",
                  },
                ]
              : reactionUsers
            ).map((row) => (
              <Text key={`${row.user_id}-${row.created_at}-${row.emoji}`} style={styles.userMeta}>
                {row.emoji} {row.username}
              </Text>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={buddyPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setBuddyPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setBuddyPickerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("friendsScreen.pickBuddyTitle")}</Text>
            <Text style={styles.modalHint}>{t("friendsScreen.pickBuddyHint")}</Text>
            <View style={styles.memberChips}>
              {friendCandidates.length === 0 ? (
                <Text style={styles.userMeta}>{t("friendsScreen.feedEmptyMessage")}</Text>
              ) : (
                friendCandidates.slice(0, 12).map((entry) => (
                  <Pressable
                    key={`buddy-${entry.user_id}`}
                    style={styles.memberChip}
                    disabled={busyActionKey === "buddy_invite"}
                    onPress={() => void inviteBuddy(entry.user_id)}
                  >
                    <Text style={styles.memberChipText}>{entry.username}</Text>
                  </Pressable>
                ))
              )}
            </View>
            <Pressable style={styles.modalCancel} onPress={() => setBuddyPickerOpen(false)}>
              <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={goalEditorOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setGoalEditorOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setGoalEditorOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("friendsScreen.editGoalTitle")}</Text>
            <Text style={styles.modalHint}>{t("friendsScreen.editGoalHint")}</Text>
            <TextInput
              value={goalTargetInput}
              onChangeText={setGoalTargetInput}
              keyboardType="number-pad"
              placeholder={t("friendsScreen.challengeTargetPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <TextInput
              value={goalDaysInput}
              onChangeText={setGoalDaysInput}
              keyboardType="number-pad"
              placeholder={t("friendsScreen.challengeDurationPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <PrimaryButton
              label={goalSaving ? t("friendsScreen.loading") : t("friendsScreen.saveGoal")}
              disabled={goalSaving}
              onPress={() => void saveCommitmentTarget()}
            />
            <Pressable style={styles.modalCancel} onPress={() => setGoalEditorOpen(false)}>
              <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={challengeCreateOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setChallengeCreateOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setChallengeCreateOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("friendsScreen.createChallengeTitle")}</Text>
            <TextInput
              value={challengeTitle}
              onChangeText={setChallengeTitle}
              placeholder={t("friendsScreen.challengeTitlePlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <View style={styles.toggleRow}>
              {(["duel", "team", "group"] as const).map((kind) => (
                <Pressable
                  key={kind}
                  style={[styles.toggleChip, challengeKind === kind && styles.toggleChipActive]}
                  onPress={() => setChallengeKind(kind)}
                >
                  <Text
                    style={[styles.toggleText, challengeKind === kind && styles.toggleTextActive]}
                  >
                    {kind}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={challengeTarget}
              onChangeText={setChallengeTarget}
              keyboardType="number-pad"
              placeholder={t("friendsScreen.challengeTargetPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <TextInput
              value={challengeDuration}
              onChangeText={setChallengeDuration}
              keyboardType="number-pad"
              placeholder={t("friendsScreen.challengeDurationPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <Text style={styles.modalHint}>{t("friendsScreen.participantsLabel")}</Text>
            <View style={styles.memberChips}>
              {entries
                .filter((entry) => entry.user_id !== user?.id)
                .slice(0, 8)
                .map((entry) => {
                  const selected = selectedMembers.includes(entry.user_id);
                  return (
                    <Pressable
                      key={entry.user_id}
                      style={[styles.memberChip, selected && styles.memberChipSelected]}
                      onPress={() =>
                        setSelectedMembers((prev) =>
                          prev.includes(entry.user_id)
                            ? prev.filter((id) => id !== entry.user_id)
                            : [...prev, entry.user_id],
                        )
                      }
                    >
                      <Text
                        style={[styles.memberChipText, selected && styles.memberChipTextSelected]}
                      >
                        {entry.username}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
            <PrimaryButton
              label={
                challengeCreateBusy
                  ? t("friendsScreen.creatingChallenge")
                  : t("friendsScreen.createChallengeCta")
              }
              disabled={challengeCreateBusy}
              onPress={() => void submitCreateChallenge()}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={addOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setAddOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("friendsScreen.modalTitle")}</Text>
            <Text style={styles.modalHint}>{t("friendsScreen.modalHint")}</Text>
            <TextInput
              value={addName}
              onChangeText={setAddName}
              placeholder={t("friendsScreen.placeholderUsername")}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <PrimaryButton
              label={addBusy ? t("friendsScreen.sendingRequest") : t("friendsScreen.sendRequest")}
              onPress={() => sendRequest()}
              disabled={addBusy}
            />
            <Pressable style={styles.modalCancel} onPress={() => setAddOpen(false)}>
              <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  emptyFriendsCard: {
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyFriendsIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emptyFriendsCopy: { gap: 4 },
  emptyFriendsTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
  },
  upsellCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.45)",
    backgroundColor: "rgba(251,191,36,0.08)",
    marginBottom: spacing.md,
    gap: 4,
  },
  upsellTitle: { color: "#fcd34d", fontFamily: fontFamily.bodyBold, ...typography.caption },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  screenSubtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    lineHeight: 20,
  },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  screenSegmentedRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  screenSegmentChip: {
    flex: 1,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  screenSegmentChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.16)",
  },
  screenSegmentText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  screenSegmentTextActive: {
    color: colors.textPrimary,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionWrap: { marginBottom: spacing.xl },
  cardElevated: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  challengeSecondaryRow: { flexDirection: "row", gap: spacing.sm },
  secondaryBtn: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnHalf: { flex: 1, minWidth: 0 },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    textAlign: "center",
  },
  sectionHintText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.body,
  },
  innerPanel: { gap: spacing.sm },
  innerHeading: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  helperText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.body,
  },
  innerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  incomingList: { gap: spacing.sm },
  incomingTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  incomingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  incomingCopy: { flex: 1 },
  incomingName: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  incomingHint: { color: colors.textSecondary, ...typography.caption },
  incomingActions: { flexDirection: "row", gap: spacing.xs },
  smallBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  acceptBtn: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.15)" },
  declineBtn: { borderColor: colors.border, backgroundColor: "transparent" },
  smallBtnText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  smallBtnTextDim: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  periodToggle: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "flex-end" },
  periodChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  periodChipActive: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.2)" },
  periodChipText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  periodChipTextActive: { color: colors.textPrimary },
  toggleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  toggleChip: {
    flex: 1,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  toggleChipActive: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.2)" },
  toggleText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  toggleTextActive: { color: colors.textPrimary },
  emptyLeader: {
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  leaderItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  leaderDivider: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#202020",
  },
  rankBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: colors.background, fontFamily: fontFamily.bodyBold, ...typography.caption },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2b2140",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatarLabel: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
  userCopy: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  userName: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  youPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.round,
    backgroundColor: "rgba(162,89,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.45)",
  },
  youPillText: { color: colors.secondary, fontFamily: fontFamily.bodyBold, fontSize: 10 },
  premiumTag: {
    color: "#fcd34d",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.45)",
    backgroundColor: "rgba(251,191,36,0.12)",
    borderRadius: radii.round,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontSize: 10,
    fontFamily: fontFamily.bodyBold,
  },
  premiumPill: {
    alignSelf: "flex-start",
    color: "#fcd34d",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.45)",
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    ...typography.caption,
  },
  userMeta: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption },
  upsellHint: { color: "#fcd34d", ...typography.caption, fontFamily: fontFamily.bodyBold },
  identityLine: {
    marginTop: spacing.xs,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodySmall,
  },
  feedEmpty: { color: colors.textSecondary, ...typography.caption },
  activityCountPill: {
    minWidth: 28,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  activityCountText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  activityFeedStack: { gap: spacing.md },
  feedItemCard: {
    position: "relative",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...shadows.card,
  },
  feedItemAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.primary,
    opacity: 0.85,
  },
  feedItemInner: { padding: spacing.md, gap: spacing.sm, paddingLeft: spacing.md + 4 },
  feedHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  feedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2b2140",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  feedAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  feedAvatarText: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, fontSize: 15 },
  feedHeaderCopy: { flex: 1, minWidth: 0 },
  feedNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  feedUserNameFlex: { flex: 1, minWidth: 0 },
  feedYouPill: {
    flexShrink: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.round,
    backgroundColor: "rgba(162,89,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.45)",
  },
  feedYouPillText: { color: colors.secondary, fontFamily: fontFamily.bodyBold, fontSize: 10 },
  feedUserName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
    lineHeight: 22,
  },
  feedSessionMeta: {
    marginTop: 2,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    lineHeight: 18,
  },
  feedActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  feedActionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  feedActionChipPressed: { backgroundColor: "rgba(255,255,255,0.08)" },
  feedActionChipText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  feedReactPrimaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.08)",
  },
  feedReactPrimaryChipActive: {
    backgroundColor: "rgba(255,61,0,0.2)",
  },
  feedReactPrimaryChipText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  feedReactPrimaryChipTextActive: {
    color: colors.textPrimary,
  },
  feedReplyChip: {
    marginLeft: "auto",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  feedReplyChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  feedReplyChipText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  feedReplyChipTextActive: { color: colors.textPrimary },
  feedComposerBlock: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  feedThreadLink: { alignSelf: "flex-start", paddingVertical: 2 },
  commentLine: { color: colors.textSecondary, ...typography.caption },
  commentAuthor: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  commentBubble: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  commentBubbleMe: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.08)" },
  commentComposerRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dayStateRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  dayStatePill: {
    borderRadius: radii.round,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  dayStateDone: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.16)" },
  dayStateMissed: { borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.04)" },
  dayStateOpen: { borderColor: colors.border, backgroundColor: "transparent" },
  dayStateText: { color: colors.textPrimary, ...typography.caption, fontFamily: fontFamily.bodyMedium },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.textPrimary,
    ...typography.caption,
  },
  commentSendBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  commentSendText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  viewAllComments: {
    color: colors.secondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  memberChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  memberChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  memberChipSelected: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.18)" },
  memberChipText: { color: colors.textSecondary, ...typography.caption },
  memberChipTextSelected: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
  challengeBlock: {
    width: "100%",
    gap: spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: spacing.sm,
  },
  challengeHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  challengeKindPill: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  challengeKindPillText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
    textTransform: "capitalize",
  },
  challengeMemberRow: { width: "100%", gap: 4, marginTop: spacing.xs },
  challengeMemberHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  challengeMemberLabel: { color: colors.textSecondary, ...typography.caption, fontFamily: fontFamily.body },
  challengeMe: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.primary },
  triggerCardPrimary: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: spacing.sm,
    backgroundColor: "rgba(255,61,0,0.12)",
    gap: spacing.xs,
  },
  triggerActionPrimary: {
    alignSelf: "flex-start",
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.24)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  triggerActionTextPrimary: {
    color: colors.textPrimary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  toast: {
    position: "absolute",
    bottom: 18,
    left: spacing.md,
    right: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(20,20,20,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  toastText: {
    color: colors.textPrimary,
    textAlign: "center",
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  modalHint: { color: colors.textSecondary, ...typography.caption },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
  },
  modalCancel: { alignItems: "center", paddingVertical: spacing.sm },
  modalCancelText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
