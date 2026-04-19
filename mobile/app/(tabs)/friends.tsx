import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
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
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { fetchEntitlement } from "../../lib/billing";
import { recordMomentumAction } from "../../lib/momentum";
import {
  createChallenge,
  createSessionComment,
  fetchBuddyStatus,
  fetchSessionReactionUsers,
  fetchSessionComments,
  fetchChallenges,
  fetchCheckinStatus,
  fetchCommitment,
  fetchSessionReactions,
  fetchWeeklyRecap,
} from "../../lib/social";
import type {
  BuddyStatusDto,
  CheckinStatusDto,
  CommitmentDto,
  FriendActivityDto,
  FriendIncomingDto,
  FriendLeaderboardDto,
  SocialChallengeDto,
  SocialCommentDto,
  SocialReactionDto,
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

function formatAgo(iso: string, t: TFunction): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return t("friendsScreen.unknownTime");
  const diff = Math.max(0, Date.now() - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("friendsWidget.agoNow");
  if (mins < 60) return t("friendsWidget.agoMinutes", { mins });
  const hours = Math.floor(mins / 60);
  if (hours < 48) return t("friendsWidget.agoHours", { hours });
  const days = Math.floor(hours / 24);
  return t("friendsWidget.agoDays", { days });
}

function formatDuration(sec: number, t: TFunction): string {
  const m = Math.floor(sec / 60);
  if (m < 1) return t("friendsScreen.durationUnderOne");
  if (m < 60) return t("friendsScreen.durationMin", { m });
  const h = Math.floor(m / 60);
  return t("friendsScreen.durationHours", { h, m: m % 60 });
}

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
  const [reactionPreview, setReactionPreview] = useState<Record<number, SocialReactionDto[]>>({});
  const [commentsBySession, setCommentsBySession] = useState<Record<number, SocialCommentDto[]>>(
    {},
  );
  const [composerBySession, setComposerBySession] = useState<Record<number, string>>({});
  const [commentBusy, setCommentBusy] = useState<Record<number, boolean>>({});
  const [commentsModalSession, setCommentsModalSession] = useState<FriendActivityDto | null>(null);
  const [commentsModalLoading, setCommentsModalLoading] = useState(false);
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
  const commentScrollRef = useRef<ScrollView | null>(null);
  const loadSeq = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadSeq.current += 1;
    };
  }, []);

  const periodParam = mode === "week" ? "week" : "all";
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
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
      const ch = await apiJson<{ challenge_id: number }>("/challenges/weekly/leaderboard", {
        token,
      }).catch(() => null);
      setChallengeId(typeof ch?.challenge_id === "number" ? ch.challenge_id : null);
      const sessionIds = (Array.isArray(feed) ? feed : [])
        .slice(0, 5)
        .map((item) => item.session_id);
      const reactions = await Promise.all(
        sessionIds.map(
          async (sessionId) =>
            [sessionId, await fetchSessionReactions(token, sessionId).catch(() => [])] as const,
        ),
      );
      setReactionPreview(Object.fromEntries(reactions));
      const firstThree = sessionIds.slice(0, 3);
      const commentSeed = await Promise.all(
        firstThree.map(
          async (sessionId) =>
            [sessionId, await fetchSessionComments(token, sessionId).catch(() => [])] as const,
        ),
      );
      setCommentsBySession((prev) => ({ ...prev, ...Object.fromEntries(commentSeed) }));
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
      setCommentsBySession({});
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

  async function joinChallenge() {
    if (!token || !challengeId) return;
    await apiJson("/challenges/join", {
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
  }

  async function submitShipCheckin() {
    if (!token) return;
    await apiJson("/challenges/checkin", {
      token,
      method: "POST",
      body: { did_ship: true, shipped_note: "Shipped this week." },
    });
    await load();
  }

  async function inviteBuddy() {
    if (!token) return;
    const candidate = entries.find((e) => user?.id !== e.user_id);
    if (!candidate) return;
    await apiJson("/social/buddy/invite", {
      token,
      method: "POST",
      body: { friend_user_id: candidate.user_id },
    });
    await load();
  }

  async function markCheckinDone() {
    if (!token) return;
    await apiJson("/social/checkins/done", { token, method: "POST", body: { note: "Done." } });
    await load();
    if (user?.id) {
      await recordMomentumAction(user.id, "checkin");
    }
    showToast(t("friendsScreen.toastMomentum"));
  }

  async function setCommitmentTarget() {
    if (!token) return;
    try {
      await apiJson("/social/commitment", {
        token,
        method: "POST",
        body: {
          target_sessions: 5,
          visibility: "friends",
          commitment_key: "sessions",
          period_days: 7,
        },
      });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      if (msg.toLowerCase().includes("premium")) {
        setUpsellMessage(msg);
      }
      Alert.alert(t("friendsScreen.couldNotSetGoal"), msg);
    }
  }

  async function addExtraCommitment() {
    if (!token) return;
    try {
      await apiJson("/social/commitment", {
        token,
        method: "POST",
        body: {
          target_sessions: 4,
          visibility: "friends",
          commitment_key: "checkins",
          period_days: 14,
        },
      });
      await load();
      showToast(t("friendsScreen.toastExtraGoal"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      if (msg.toLowerCase().includes("premium")) {
        setUpsellMessage(t("friendsScreen.upsellTrackMoreGoals"));
      }
      Alert.alert(t("friendsScreen.couldNotAddGoal"), msg);
    }
  }

  async function submitComment(sessionId: number) {
    if (!token) return;
    const text = (composerBySession[sessionId] ?? "").trim();
    if (!text) return;
    setCommentBusy((prev) => ({ ...prev, [sessionId]: true }));
    try {
      await createSessionComment(token, sessionId, text);
      setComposerBySession((prev) => ({ ...prev, [sessionId]: "" }));
      const fresh = await fetchSessionComments(token, sessionId);
      setCommentsBySession((prev) => ({ ...prev, [sessionId]: fresh }));
      if (user?.id) {
        await recordMomentumAction(user.id, "social");
      }
      showToast(t("friendsScreen.toastSocialEngaged"));
      setTimeout(() => {
        commentScrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } catch (e) {
      Alert.alert(
        t("friendsScreen.couldNotSendComment"),
        e instanceof Error ? e.message : t("common.tryAgain"),
      );
    } finally {
      setCommentBusy((prev) => ({ ...prev, [sessionId]: false }));
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

  const openComments = useCallback(
    async (item: FriendActivityDto) => {
      if (!token) return;
      setCommentsModalSession(item);
      setCommentsModalLoading(true);
      const fresh = await fetchSessionComments(token, item.session_id).catch(() => []);
      setCommentsBySession((prev) => ({ ...prev, [item.session_id]: fresh }));
      setCommentsModalLoading(false);
      setTimeout(() => {
        commentScrollRef.current?.scrollToEnd({ animated: false });
      }, 50);
    },
    [token],
  );

  async function openReactionUsers(sessionId: number) {
    if (!token) return;
    setReactionUsersOpen(true);
    const rows = await fetchSessionReactionUsers(token, sessionId).catch(() => []);
    setReactionUsers(rows);
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
            .catch(() => undefined);
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
          if (activity[0]) void openComments(activity[0]);
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
            .catch(() => undefined);
        },
      });
    }
    return cards;
  }, [buddy, challengeCards, user?.id, token, activity, showToast, load, openComments, t]);

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
          <Text style={styles.title}>{t("friendsScreen.title")}</Text>
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
        {entitlement?.entitlement !== "premium" && upsellMessage ? (
          <View style={styles.upsellCard}>
            <Text style={styles.upsellTitle}>{t("friendsScreen.premiumBoost")}</Text>
            <Text style={styles.userMeta}>{upsellMessage}</Text>
          </View>
        ) : null}
        <View style={styles.challengeRow}>
          <PrimaryButton
            label={t("friendsScreen.joinCreativeChallenge")}
            onPress={() => void joinChallenge()}
          />
          <PrimaryButton
            label={t("friendsScreen.droppedThisWeek")}
            onPress={() => void submitShipCheckin()}
          />
          <PrimaryButton
            label={t("friendsScreen.createCreativeChallenge")}
            onPress={() => setChallengeCreateOpen(true)}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.incomingTitle}>{t("friendsScreen.buddyConnection")}</Text>
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
              label={t("friendsScreen.inviteBuddy")}
              onPress={() => void inviteBuddy()}
            />
          ) : null}
          {buddy?.status === "pending_incoming" && buddy.invite_id ? (
            <PrimaryButton
              label={t("friendsScreen.acceptBuddyInvite")}
              onPress={async () => {
                if (!token) return;
                await apiJson("/social/buddy/accept", {
                  token,
                  method: "POST",
                  body: { invite_id: buddy.invite_id },
                });
                await load();
              }}
            />
          ) : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.incomingTitle}>{t("friendsScreen.studioActivity")}</Text>
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
          <PrimaryButton
            label={t("friendsScreen.logActivity")}
            onPress={() => void markCheckinDone()}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.incomingTitle}>{t("friendsScreen.creativeGoal")}</Text>
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
            label={t("friendsScreen.setGoalFive")}
            onPress={() => void setCommitmentTarget()}
          />
          <PrimaryButton
            label={t("friendsScreen.addExtraGoal")}
            onPress={() => void addExtraCommitment()}
          />
          {commitment?.status === "completed" ? (
            <Text style={styles.upsellHint}>{t("friendsScreen.upsellInviteFriend")}</Text>
          ) : null}
          {commitment?.upsell_hint && entitlement?.entitlement !== "premium" ? (
            <Text style={styles.upsellHint}>{commitment.upsell_hint}</Text>
          ) : null}
        </View>

        {loading && !refreshing ? <LoadingState message={t("friendsScreen.loading")} /> : null}

        {error ? (
          <ErrorState
            title={t("common.oops")}
            message={error}
            retryLabel={t("common.tryAgain")}
            onRetry={() => load().catch(() => undefined)}
          />
        ) : null}

        {incoming.length > 0 ? (
          <View style={styles.incomingBlock}>
            <Text style={styles.incomingTitle}>{t("friendsScreen.incomingTitle")}</Text>
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
        ) : null}

        <View style={styles.toggleRow}>
          {modeOptions.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.toggleChip, mode === item.key && styles.toggleChipActive]}
              onPress={() => setMode(item.key)}
            >
              <Text style={[styles.toggleText, mode === item.key && styles.toggleTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.block}>
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
                <View style={styles.avatar}>
                  <Text style={styles.avatarLabel}>{entry.username.slice(0, 2).toUpperCase()}</Text>
                </View>
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

        <Text style={styles.sectionTitle}>{t("friendsScreen.activityTitle")}</Text>
        {activeTriggerCard ? (
          <View style={styles.block}>
            <View key={activeTriggerCard.key} style={styles.triggerCardPrimary}>
              <Text style={styles.userName}>{activeTriggerCard.title}</Text>
              <Pressable
                style={styles.triggerActionPrimary}
                onPress={() => {
                  activeTriggerCard.onPress();
                  completeTriggerAction();
                }}
              >
                <Text style={styles.triggerActionTextPrimary}>{activeTriggerCard.actionLabel}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.block}>
          {activity.length === 0 && !loading ? (
            <EmptyState
              icon="🎛️"
              title={t("friendsScreen.activityTitle")}
              message={t("friendsScreen.feedEmpty")}
            />
          ) : null}
          {activity.map((item, idx) => (
            <Pressable
              key={item.session_id}
              style={[styles.feedRow, idx !== activity.length - 1 && styles.feedDivider]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                router.push(`/profile/${item.user_id}`);
              }}
            >
              <View style={styles.feedDot} />
              <Text style={styles.feedText}>
                {t("friendsScreen.feedLine", {
                  user: item.username,
                  type: item.session_type,
                  duration: formatDuration(item.duration_seconds, t),
                  ago: formatAgo(item.completed_at, t),
                })}
              </Text>
              <View style={styles.socialStatsRow}>
                <Pressable onPress={() => void openReactionUsers(item.session_id)}>
                  <Text style={styles.userMeta}>
                    👍{" "}
                    {(reactionPreview[item.session_id] ?? []).reduce((acc, r) => acc + r.count, 0)}
                  </Text>
                </Pressable>
                <Pressable onPress={() => void openComments(item)}>
                  <Text style={styles.userMeta}>
                    💬{" "}
                    {(commentsBySession[item.session_id] ?? []).length > 0
                      ? (commentsBySession[item.session_id] ?? []).length
                      : 0}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.commentComposerRow}>
                <TextInput
                  value={composerBySession[item.session_id] ?? ""}
                  onChangeText={(value) =>
                    setComposerBySession((prev) => ({
                      ...prev,
                      [item.session_id]: value,
                    }))
                  }
                  placeholder={t("friendsScreen.commentPlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                  style={styles.commentInput}
                />
                <Pressable
                  style={({ pressed }) => [styles.commentSendBtn, pressed && { opacity: 0.8 }]}
                  disabled={commentBusy[item.session_id]}
                  onPress={() => void submitComment(item.session_id)}
                >
                  <Text style={styles.commentSendText}>
                    {commentBusy[item.session_id]
                      ? t("friendsScreen.commentSendingShort")
                      : t("friendsScreen.commentSend")}
                  </Text>
                </Pressable>
              </View>
              <Pressable onPress={() => void openComments(item)}>
                <Text style={styles.viewAllComments}>
                  {(commentsBySession[item.session_id] ?? []).length > 0
                    ? t("friendsScreen.viewAllComments")
                    : t("friendsScreen.beFirstToComment")}
                </Text>
              </Pressable>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t("friendsScreen.socialChallenges")}</Text>
        <View style={styles.block}>
          {challengeCards.length === 0 ? (
            <>
              <Text style={styles.feedEmpty}>{t("friendsScreen.noChallengesYet")}</Text>
              <PrimaryButton
                label={t("friendsScreen.startFirstChallenge")}
                onPress={() => setChallengeCreateOpen(true)}
              />
            </>
          ) : null}
          {challengeCards.map((challenge) => (
            <View key={challenge.id} style={styles.feedRow}>
              <Text style={styles.userName}>
                {challenge.title} ({challenge.challenge_kind})
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
                      : t("friendsScreen.challengeLabelBuildingPressure");
                return (
                  <View key={`${challenge.id}-${m.user_id}`} style={styles.challengeMemberRow}>
                    <Text style={[styles.userMeta, me && styles.challengeMe]}>
                      {m.username} {m.progress_sessions}/{challenge.target_sessions} · {label}
                    </Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t("friendsScreen.weeklySocialRecap")}</Text>
        <View style={styles.block}>
          <Text style={styles.userMeta}>{recap?.recap_line ?? t("friendsScreen.noRecapYet")}</Text>
          {recap?.identity_line ? (
            <Text style={styles.identityLine}>{recap.identity_line}</Text>
          ) : null}
          {recap ? (
            <Text style={styles.userMeta}>
              Team {recap.team_sessions} · WoW {recap.wow_delta_sessions >= 0 ? "+" : ""}
              {recap.wow_delta_sessions}
            </Text>
          ) : null}
          {recap?.premium_detail_locked ? (
            <Text style={styles.upsellHint}>
              {recap.upsell_hint ?? t("friendsScreen.unlockPremiumInsights")}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {toastMessage ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}

      <Modal
        visible={commentsModalSession !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsModalSession(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCommentsModalSession(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("friendsScreen.commentsTitle")}</Text>
            <ScrollView ref={commentScrollRef} style={{ maxHeight: 320 }}>
              {commentsModalLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (commentsBySession[commentsModalSession?.session_id ?? -1] ?? []).length === 0 ? (
                <Text style={styles.feedEmpty}>{t("friendsScreen.beFirstToComment")}</Text>
              ) : (
                (commentsBySession[commentsModalSession?.session_id ?? -1] ?? []).map((comment) => (
                  <View
                    key={comment.id}
                    style={[
                      styles.commentBubble,
                      comment.author_id === user?.id && styles.commentBubbleMe,
                    ]}
                  >
                    <Text style={styles.commentAuthor}>{comment.author_username}</Text>
                    <Text style={styles.commentLine}>{comment.body}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            {commentsModalSession ? (
              <View style={styles.commentComposerRow}>
                <TextInput
                  value={composerBySession[commentsModalSession.session_id] ?? ""}
                  onChangeText={(value) =>
                    setComposerBySession((prev) => ({
                      ...prev,
                      [commentsModalSession.session_id]: value,
                    }))
                  }
                  placeholder={t("friendsScreen.commentPlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                  style={styles.commentInput}
                />
                <Pressable
                  style={({ pressed }) => [styles.commentSendBtn, pressed && { opacity: 0.8 }]}
                  disabled={commentBusy[commentsModalSession.session_id]}
                  onPress={() => void submitComment(commentsModalSession.session_id)}
                >
                  <Text style={styles.commentSendText}>{t("friendsScreen.commentSend")}</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={reactionUsersOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setReactionUsersOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setReactionUsersOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("friendsScreen.reactionsTitle")}</Text>
            {(reactionUsers.length === 0
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
    alignItems: "center",
    marginBottom: spacing.md,
  },
  challengeRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
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
  incomingBlock: { marginBottom: spacing.md, gap: spacing.sm },
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
  block: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
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
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.subheadline,
  },
  feedEmpty: { color: colors.textSecondary, ...typography.caption },
  feedRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    paddingVertical: spacing.xs,
  },
  feedDivider: { borderBottomWidth: 1, borderBottomColor: "#202020", paddingBottom: spacing.sm },
  feedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  feedText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  commentWrap: { flex: 1, marginTop: spacing.xs, gap: 4 },
  socialStatsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
  challengeMemberRow: { width: "100%", gap: 4, marginTop: spacing.xs },
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
