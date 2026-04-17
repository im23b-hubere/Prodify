import { Search } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

const leaderboard = [
  { rank: 1, username: "NovaBeats", streak: 28, sessions: 51 },
  { rank: 2, username: "LoFiMiles", streak: 21, sessions: 44 },
  { rank: 3, username: "KICKR", streak: 17, sessions: 38 },
  { rank: 4, username: "EchoState", streak: 12, sessions: 32 },
];

const activities = [
  "NovaBeats completed a session · 2h ago",
  "LoFiMiles hit a 21 day streak · 4h ago",
  "KICKR finished Mix session · 7h ago",
];

function rankColor(rank: number) {
  if (rank === 1) return "#fbbf24";
  if (rank === 2) return "#d1d5db";
  if (rank === 3) return "#cd7f32";
  return colors.secondary;
}

export default function FriendsScreen() {
  const [mode, setMode] = useState<"This Week" | "All Time">("This Week");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Friends</Text>
          <Pressable style={styles.iconButton}>
            <Search color={colors.textPrimary} size={18} />
          </Pressable>
        </View>

        <View style={styles.toggleRow}>
          {(["This Week", "All Time"] as const).map((item) => (
            <Pressable key={item} style={[styles.toggleChip, mode === item && styles.toggleChipActive]} onPress={() => setMode(item)}>
              <Text style={[styles.toggleText, mode === item && styles.toggleTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.block}>
          {leaderboard.map((entry) => (
            <View key={entry.username} style={styles.leaderItem}>
              <View style={[styles.rankBadge, { backgroundColor: rankColor(entry.rank) }]}>
                <Text style={styles.rankText}>#{entry.rank}</Text>
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarLabel}>{entry.username.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.userCopy}>
                <Text style={styles.userName}>{entry.username}</Text>
                <Text style={styles.userMeta}>{mode === "This Week" ? `${entry.streak} day streak` : `${entry.sessions} sessions`}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Activity Feed</Text>
        <View style={styles.block}>
          {activities.map((item, idx) => (
            <View key={item} style={[styles.feedRow, idx !== activities.length - 1 && styles.feedDivider]}>
              <View style={styles.feedDot} />
              <Text style={styles.feedText}>{item}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
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
  leaderItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rankBadge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  rankText: { color: colors.background, fontFamily: fontFamily.bodyBold, ...typography.caption },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2b2140", justifyContent: "center", alignItems: "center" },
  avatarLabel: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
  userCopy: { flex: 1 },
  userName: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  userMeta: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.subheadline },
  feedRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", paddingVertical: spacing.xs },
  feedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  feedText: { flex: 1, color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption },
  feedDivider: { borderBottomWidth: 1, borderBottomColor: "#202020", paddingBottom: spacing.sm },
});
