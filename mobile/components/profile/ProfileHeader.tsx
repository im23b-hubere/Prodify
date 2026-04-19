import { LinearGradient } from "expo-linear-gradient";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  username: string;
  totalSessions: number;
  currentStreak: number;
  friendsCount: number;
  status: "self" | "none" | "pending" | "accepted";
  isPremium?: boolean;
  identityTags?: string[];
  onAddFriend?: () => void;
};

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return `${p[0]![0] ?? ""}${p[1]![0] ?? ""}`.toUpperCase();
}

export const ProfileHeader = memo(function ProfileHeader({
  username,
  totalSessions,
  currentStreak,
  friendsCount,
  status,
  isPremium = false,
  identityTags = [],
  onAddFriend,
}: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={["#3d1510", "#141414"]} style={styles.gradient} />
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{initials(username)}</Text>
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.username}>{username}</Text>
          {isPremium ? <Text style={styles.premiumBadge}>PRO</Text> : null}
        </View>
        {identityTags.length > 0 ? (
          <View style={styles.identityRow}>
            {identityTags.slice(0, 2).map((tag) => (
              <View key={tag} style={styles.identityTag}>
                <Text style={styles.identityText}>
                  {tag.replace("_", " ").replace(/\b\w/g, (m) => m.toUpperCase())}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.quick}>
          <View style={styles.qItem}>
            <Text style={styles.qVal}>{totalSessions}</Text>
            <Text style={styles.qLbl}>{t("profileHeader.sessions")}</Text>
          </View>
          <View style={styles.qItem}>
            <Text style={styles.qVal}>
              {currentStreak}
              <Text style={styles.fire}> 🔥</Text>
            </Text>
            <Text style={styles.qLbl}>{t("profileHeader.streak")}</Text>
          </View>
          <View style={styles.qItem}>
            <Text style={styles.qVal}>{friendsCount}</Text>
            <Text style={styles.qLbl}>{t("profileHeader.friends")}</Text>
          </View>
        </View>
        {status === "none" ? (
          <Pressable style={styles.followBtn} onPress={onAddFriend}>
            <Text style={styles.followTxt}>{t("profileHeader.addFriend")}</Text>
          </Pressable>
        ) : status === "pending" ? (
          <View style={styles.pendingPill}>
            <Text style={styles.pendingTxt}>{t("profileHeader.requestPending")}</Text>
          </View>
        ) : status === "accepted" ? (
          <View style={styles.followingPill}>
            <Text style={styles.followingTxt}>{t("profileHeader.friendsBadge")}</Text>
          </View>
        ) : (
          <View style={styles.followingPill}>
            <Text style={styles.followingTxt}>{t("profileHeader.you")}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { borderRadius: radii.xl, overflow: "hidden", marginBottom: spacing.md },
  gradient: { ...StyleSheet.absoluteFillObject },
  content: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.sm },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,106,61,0.2)",
    borderWidth: 2,
    borderColor: "rgba(255,106,61,0.5)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  avatarTxt: { fontSize: 28, fontFamily: fontFamily.heading, color: colors.textPrimary },
  username: {
    textAlign: "center",
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 24,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  identityRow: { flexDirection: "row", justifyContent: "center", gap: spacing.xs },
  identityTag: {
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  identityText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  premiumBadge: {
    color: "#fcd34d",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.45)",
    backgroundColor: "rgba(251,191,36,0.1)",
    borderRadius: radii.round,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontSize: 10,
    fontFamily: fontFamily.bodyBold,
  },
  quick: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.sm },
  qItem: { alignItems: "center", gap: 4 },
  qVal: { color: colors.textPrimary, fontFamily: fontFamily.heading, fontSize: 18 },
  fire: { fontSize: 14 },
  qLbl: { color: colors.textSecondary, ...typography.caption },
  followBtn: {
    marginTop: spacing.md,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  followTxt: { color: "#fff", fontFamily: fontFamily.bodyBold, ...typography.body },
  pendingPill: {
    alignSelf: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingTxt: { color: colors.textSecondary, ...typography.caption },
  followingPill: {
    alignSelf: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
  },
  followingTxt: { color: "#86efac", fontFamily: fontFamily.bodyBold, ...typography.caption },
});
