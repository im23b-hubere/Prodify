import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Search } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
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
import type { FriendActivityDto, FriendIncomingDto, FriendLeaderboardDto } from "../../types/friends";

function rankColor(rank: number) {
  if (rank === 1) return "#fbbf24";
  if (rank === 2) return "#d1d5db";
  if (rank === 3) return "#cd7f32";
  return colors.secondary;
}

function formatAgo(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "unknown time";
  const diff = Math.max(0, Date.now() - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 1) return "<1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function FriendsScreen() {
  const { token, user } = useAuth();
  const [mode, setMode] = useState<"This Week" | "All Time">("This Week");
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

  const periodParam = mode === "This Week" ? "week" : "all";

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
      setError(e instanceof Error ? e.message : "Could not load friends.");
      setLeaderboard(null);
      setActivity([]);
      setIncoming([]);
    } finally {
      if (!mounted.current || seq !== loadSeq.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, periodParam]);

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
      Alert.alert("Username", "Enter a valid username.");
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
      Alert.alert("Request sent", `Friend request sent to ${u}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed.";
      Alert.alert("Could not send", msg);
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
      Alert.alert("Error", e instanceof Error ? e.message : "Accept failed.");
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
      Alert.alert("Error", e instanceof Error ? e.message : "Decline failed.");
    } finally {
      setActionBusy(null);
    }
  }

  const entries = leaderboard?.entries ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Friends</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add friend"
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
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => load().catch(() => undefined)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {incoming.length > 0 ? (
          <View style={styles.incomingBlock}>
            <Text style={styles.incomingTitle}>Incoming requests</Text>
            {incoming.map((req) => (
              <View key={req.id} style={styles.incomingRow}>
                <View style={styles.incomingCopy}>
                  <Text style={styles.incomingName}>{req.username}</Text>
                  <Text style={styles.incomingHint}>wants to be friends</Text>
                </View>
                <View style={styles.incomingActions}>
                  <Pressable
                    style={({ pressed }) => [styles.smallBtn, styles.acceptBtn, pressed && { opacity: 0.9 }]}
                    disabled={actionBusy === req.id}
                    onPress={() => acceptRequest(req.id)}
                  >
                    <Text style={styles.smallBtnText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.smallBtn, styles.declineBtn, pressed && { opacity: 0.9 }]}
                    disabled={actionBusy === req.id}
                    onPress={() => declineRequest(req.id)}
                  >
                    <Text style={styles.smallBtnTextDim}>Decline</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.toggleRow}>
          {(["This Week", "All Time"] as const).map((item) => (
            <Pressable key={item} style={[styles.toggleChip, mode === item && styles.toggleChipActive]} onPress={() => setMode(item)}>
              <Text style={[styles.toggleText, mode === item && styles.toggleTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.block}>
          {!loading && entries.length === 1 && user?.id === entries[0]?.user_id ? (
            <Text style={styles.emptyLeader}>You're solo on the leaderboard — add friends to compare stats.</Text>
          ) : null}
          {entries.map((entry, idx) => (
            <Animated.View key={`${entry.user_id}-${entry.rank}`} entering={FadeInDown.delay(idx * 35).duration(320)}>
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
                        <Text style={styles.youPillText}>You</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.userMeta}>
                    {mode === "This Week"
                      ? `${entry.sessions_in_period} session${entry.sessions_in_period === 1 ? "" : "s"} this week · ${entry.current_streak_days} day streak`
                      : `${entry.sessions_in_period} session${entry.sessions_in_period === 1 ? "" : "s"} total · ${entry.current_streak_days} day streak`}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Activity feed</Text>
        <View style={styles.block}>
          {activity.length === 0 && !loading ? (
            <Text style={styles.feedEmpty}>No recent sessions among friends yet.</Text>
          ) : null}
          {activity.map((item, idx) => (
            <View key={item.session_id} style={[styles.feedRow, idx !== activity.length - 1 && styles.feedDivider]}>
              <View style={styles.feedDot} />
              <Text style={styles.feedText}>
                <Text style={styles.feedName}>{item.username}</Text>
                {` finished ${item.session_type}`}
                {` · ${formatDuration(item.duration_seconds)} · ${formatAgo(item.completed_at)}`}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add friend</Text>
            <Text style={styles.modalHint}>Enter their BeatTrack username. They will need to accept your request.</Text>
            <TextInput
              value={addName}
              onChangeText={setAddName}
              placeholder="Username"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <PrimaryButton label={addBusy ? "Sending…" : "Send request"} onPress={() => sendRequest()} disabled={addBusy} />
            <Pressable style={styles.modalCancel} onPress={() => setAddOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
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
  loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
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
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
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
  incomingTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.caption, marginBottom: spacing.xs },
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
  smallBtnText: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  smallBtnTextDim: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold, ...typography.caption },
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
  toggleText: { color: colors.textSecondary, fontFamily: fontFamily.bodyMedium, ...typography.caption },
  toggleTextActive: { color: colors.textPrimary },
  block: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyLeader: { color: colors.textSecondary, ...typography.caption, textAlign: "center", paddingVertical: spacing.md },
  leaderItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  leaderDivider: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: "#202020" },
  rankBadge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  rankText: { color: colors.background, fontFamily: fontFamily.bodyBold, ...typography.caption },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2b2140", justifyContent: "center", alignItems: "center" },
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
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.subheadline },
  feedEmpty: { color: colors.textSecondary, ...typography.caption },
  feedRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", paddingVertical: spacing.xs },
  feedDivider: { borderBottomWidth: 1, borderBottomColor: "#202020", paddingBottom: spacing.sm },
  feedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  feedText: { flex: 1, color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption },
  feedName: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
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
  modalTitle: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.subheadline },
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
  modalCancelText: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold, ...typography.caption },
});
