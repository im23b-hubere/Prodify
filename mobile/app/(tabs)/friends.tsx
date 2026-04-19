import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Search } from "lucide-react-native";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
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
import Animated, { FadeInDown } from "react-native-reanimated";

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import type {
  FriendActivityDto,
  FriendIncomingDto,
  FriendLeaderboardDto,
} from "../../types/friends";

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

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    if (!token) {
      if (mounted.current) setLoading(false);
      return;
    }
    if (mounted.current) setError(null);
    try {
      const [board, feed, inc] = await Promise.all([
        apiJson<FriendLeaderboardDto>(`/friends/leaderboard?period=${periodParam}`, { token }),
        apiJson<FriendActivityDto[]>("/friends/activity?limit=20", { token }),
        apiJson<FriendIncomingDto[]>("/friends/incoming", { token }),
      ]);
      if (!mounted.current || seq !== loadSeq.current) return;
      setLeaderboard(board);
      setActivity(Array.isArray(feed) ? feed : []);
      setIncoming(Array.isArray(inc) ? inc : []);
    } catch (e) {
      if (!mounted.current || seq !== loadSeq.current) return;
      setError(e instanceof Error ? e.message : t("friendsScreen.loadError"));
      setLeaderboard(null);
      setActivity([]);
      setIncoming([]);
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
      Alert.alert(t("friendsScreen.requestSentTitle"), t("friendsScreen.requestSentBody", { name: u }));
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
      await load();
    } catch (e) {
      Alert.alert(t("friendsScreen.errorGeneric"), e instanceof Error ? e.message : t("friendsScreen.acceptFailed"));
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
      Alert.alert(t("friendsScreen.errorGeneric"), e instanceof Error ? e.message : t("friendsScreen.declineFailed"));
    } finally {
      setActionBusy(null);
    }
  }

  const entries = leaderboard?.entries ?? [];

  const modeOptions = [
    { key: "week" as const, label: t("friendsScreen.modeWeek") },
    { key: "all" as const, label: t("friendsScreen.modeAll") },
  ];

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

        {loading && !refreshing ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>{t("friendsScreen.loading")}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => load().catch(() => undefined)}>
              <Text style={styles.retryText}>{t("friendsScreen.retry")}</Text>
            </Pressable>
          </View>
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
              <View style={[styles.leaderItem, idx > 0 && styles.leaderDivider]}>
                <View style={[styles.rankBadge, { backgroundColor: rankColor(entry.rank) }]}>
                  <Text style={styles.rankText}>#{entry.rank}</Text>
                </View>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLabel}>{entry.username.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={styles.userCopy}>
                  <View style={styles.nameRow}>
                    <Text style={styles.userName}>{entry.username}</Text>
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
                </View>
              </View>
            </Animated.View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t("friendsScreen.activityTitle")}</Text>
        <View style={styles.block}>
          {activity.length === 0 && !loading ? (
            <Text style={styles.feedEmpty}>{t("friendsScreen.feedEmpty")}</Text>
          ) : null}
          {activity.map((item, idx) => (
            <View
              key={item.session_id}
              style={[styles.feedRow, idx !== activity.length - 1 && styles.feedDivider]}
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
            </View>
          ))}
        </View>
      </ScrollView>

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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  muted: { color: colors.textSecondary, ...typography.caption },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,80,80,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.25)",
    marginBottom: spacing.md,
  },
  errorText: { color: "#ff9a9a", ...typography.caption, marginBottom: spacing.xs },
  retryText: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  userMeta: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption },
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
