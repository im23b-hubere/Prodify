import { memo } from "react";
import { useTranslation } from "react-i18next";
import { UserCheck } from "lucide-react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { AppFlame, glyphRowStyle } from "../icons/ProdifyGlyphs";

type Props = {
  username: string;
  totalSessions: number;
  currentStreak: number;
  friendsCount: number;
  status: "self" | "none" | "pending" | "accepted";
  identityTags?: string[];
  streakStatusLabel?: string;
  streakStatusEmoji?: string;
  profilePictureUrl?: string | null;
  onAddFriend?: () => void;
};

const FRIEND_GREEN = "#86efac";

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return `${p[0]![0] ?? ""}${p[1]![0] ?? ""}`.toUpperCase();
}

function FriendshipBadge({ status, onAddFriend }: Pick<Props, "status" | "onAddFriend">) {
  const { t } = useTranslation();
  if (status === "none") {
    return (
      <Pressable style={styles.followBtn} onPress={onAddFriend}>
        <Text style={styles.followTxt}>{t("profileHeader.addFriend")}</Text>
      </Pressable>
    );
  }
  if (status === "pending") {
    return (
      <View style={styles.pendingPill}>
        <Text style={styles.pendingTxt}>{t("profileHeader.requestPending")}</Text>
      </View>
    );
  }
  // Friends get a small mark next to their name instead (see ProfileHeader); your own
  // profile needs no badge at all.
  return null;
}

export const ProfileHeader = memo(function ProfileHeader({
  username,
  totalSessions,
  currentStreak,
  friendsCount,
  status,
  identityTags = [],
  streakStatusLabel,
  streakStatusEmoji,
  profilePictureUrl,
  onAddFriend,
}: Props) {
  const { t } = useTranslation();
  // An open heading like the Profile tab's, not a card: the page's glow sits behind it.
  return (
    <View style={styles.wrap} testID="profile-header">
      <View style={styles.content}>
        <View style={styles.avatar}>
          {profilePictureUrl ? (
            <Image source={{ uri: profilePictureUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarTxt}>{initials(username)}</Text>
          )}
        </View>
        <View style={styles.nameRow}>
          <Text
            style={styles.username}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {username}
          </Text>
          {status === "accepted" ? (
            <View accessible accessibilityLabel={t("profileHeader.friendsBadge")}>
              <UserCheck color={FRIEND_GREEN} size={20} strokeWidth={2.4} />
            </View>
          ) : null}
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
        {streakStatusLabel ? (
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>
              {streakStatusEmoji ?? "🌱"} {streakStatusLabel}
            </Text>
          </View>
        ) : null}
        <View style={styles.quick}>
          <View style={styles.qItem}>
            <Text style={styles.qVal}>{totalSessions}</Text>
            <Text style={styles.qLbl}>{t("profileHeader.sessions")}</Text>
          </View>
          <View style={styles.qDivider} />
          <View style={styles.qItem}>
            <View style={[glyphRowStyle, styles.qValRow]}>
              <Text style={styles.qVal}>{currentStreak}</Text>
              <AppFlame size={16} />
            </View>
            <Text style={styles.qLbl}>{t("profileHeader.streak")}</Text>
          </View>
          <View style={styles.qDivider} />
          <View style={styles.qItem}>
            <Text style={styles.qVal}>{friendsCount}</Text>
            <Text style={styles.qLbl}>{t("profileHeader.friends")}</Text>
          </View>
        </View>
        <FriendshipBadge status={status} onAddFriend={onAddFriend} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.lg, marginBottom: spacing.md },
  content: { alignItems: "center", gap: spacing.sm },
  // Same ring and size as the avatar on your own Profile tab.
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(255,61,0,0.14)",
    borderWidth: 2,
    borderColor: "rgba(255,61,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  avatarTxt: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  avatarImage: { width: "100%", height: "100%" },
  username: {
    flexShrink: 1,
    textAlign: "center",
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.screenTitle,
  },
  nameRow: {
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
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
  statusPill: {
    alignSelf: "center",
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  statusPillText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  quick: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
  },
  qItem: { flex: 1, alignItems: "center", gap: 4 },
  qDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border },
  qVal: { color: colors.textPrimary, fontFamily: fontFamily.heading, fontSize: 18 },
  qValRow: { justifyContent: "center" },
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
});
