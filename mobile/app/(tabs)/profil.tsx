import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { BadgeIcon } from "../../components/ui/BadgeIcon";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { StatCard } from "../../components/ui/StatCard";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";

const badges = [
  { label: "Starter", unlocked: true },
  { label: "7 Day Run", unlocked: true },
  { label: "Marathon", unlocked: false },
  { label: "Top 1%", unlocked: false },
];

export default function ProfilScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function logout() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    await signOut();
    router.replace("/(auth)/login");
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 450));
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.username?.slice(0, 2).toUpperCase() ?? "BT"}</Text>
          </View>
          <Text style={styles.username}>{user?.username ?? "BeatTrack User"}</Text>
          <Text style={styles.email}>{user?.email ?? "loading..."}</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Total Sessions" value={42} />
          <StatCard label="Best Streak" value={9} />
          <StatCard label="Total Hours" value="48.1" />
          <StatCard label="Rank" value="#23" />
        </View>

        <Text style={styles.sectionTitle}>Badges</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>
          {badges.map((badge) => (
            <BadgeIcon key={badge.label} label={badge.label} unlocked={badge.unlocked} />
          ))}
        </ScrollView>

        <View style={styles.settingsWrap}>
          <PrimaryButton label="Settings" onPress={() => {}} />
        </View>

        <View style={styles.signoutWrap}>
          <Pressable style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]} onPress={logout}>
            <Text style={styles.outlineBtnText}>Abmelden</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  profileHero: { alignItems: "center", marginBottom: spacing.lg },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#2b2140",
    borderWidth: 2,
    borderColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  username: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  email: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.subheadline,
  },
  badgesRow: {
    gap: spacing.sm,
  },
  settingsWrap: {
    marginTop: spacing.lg,
  },
  signoutWrap: {
    marginTop: spacing.md,
  },
  outlineBtn: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  outlineBtnText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
});
