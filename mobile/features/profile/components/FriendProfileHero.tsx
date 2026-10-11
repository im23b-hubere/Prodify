import { LinearGradient } from "expo-linear-gradient";
import { Crown, Swords, UserCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image, Text, View } from "react-native";

import { AppFlame } from "../../../components/icons/ProdifyGlyphs";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors } from "../../../constants/theme";
import {
  identityTagLabel,
  memberSinceDate,
  profileInitials,
  profilePictureUrl,
} from "../friendProfilePresentation";
import { friendProfileStyles as styles } from "../friendProfile.styles";
import type { FriendProfilePayload } from "../hooks/useFriendProfile";

const FRIEND_GREEN = "#86efac";
const PREMIUM_GOLD = "#facc15";
const STREAK_RING = ["#ff8a3d", colors.primary, "#a3260a"] as const;

type AvatarProps = { username: string; pictureUrl: string | null; streak: number };

export function ProfileAvatar({ username, pictureUrl, streak }: AvatarProps) {
  const hasStreak = streak > 0;
  const avatar = (
    <View style={styles.avatar}>
      {pictureUrl ? (
        <Image
          source={{ uri: pictureUrl }}
          style={styles.avatarImage}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={styles.avatarInitials}>{profileInitials(username)}</Text>
      )}
    </View>
  );
  return (
    <View>
      {hasStreak ? (
        <LinearGradient colors={STREAK_RING} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
          {avatar}
        </LinearGradient>
      ) : (
        <View style={[styles.avatarRing, styles.avatarRingIdle]}>{avatar}</View>
      )}
      {hasStreak ? (
        <View style={styles.streakBadge}>
          <AppFlame size={12} />
          <Text style={styles.streakBadgeText}>{streak}</Text>
        </View>
      ) : null}
    </View>
  );
}

type HeroProps = {
  profile: FriendProfilePayload;
  isOwnProfile: boolean;
  isBuddy: boolean;
  onChallenge: () => void;
};

export function FriendProfileHero({ profile, isOwnProfile, isBuddy, onChallenge }: HeroProps) {
  const { t } = useTranslation();
  const memberSince = memberSinceDate(profile.created_at);
  const meta = [
    memberSince ? t("friendProfile.memberSince", { date: memberSince }) : null,
    t("friendProfile.friendsCount", { count: profile.friends_count }),
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <View style={styles.hero} testID="friend-profile-hero">
      <ProfileAvatar
        username={profile.username}
        pictureUrl={profilePictureUrl(profile.profile_picture_url)}
        streak={profile.current_streak}
      />
      <View style={styles.nameRow}>
        <Text style={styles.username} numberOfLines={1} accessibilityRole="header">
          {profile.username}
        </Text>
        {!isOwnProfile ? (
          <View accessible accessibilityLabel={t("profileHeader.friendsBadge")}>
            <UserCheck color={FRIEND_GREEN} size={20} strokeWidth={2.4} />
          </View>
        ) : null}
        {profile.is_premium ? (
          <View accessible accessibilityLabel={t("friendProfile.premiumA11y")}>
            <Crown color={PREMIUM_GOLD} fill={PREMIUM_GOLD} size={18} strokeWidth={2} />
          </View>
        ) : null}
      </View>
      <Text style={styles.heroMeta}>{meta}</Text>
      <HeroChips profile={profile} isBuddy={isBuddy} />
      {isOwnProfile ? (
        <Text style={styles.selfNote}>{t("friendProfile.selfPreviewNote")}</Text>
      ) : (
        <View style={styles.heroActions}>
          <PrimaryButton
            label={t("friendProfile.challengeCta", { name: profile.username })}
            icon={<Swords color={colors.textPrimary} size={18} strokeWidth={2.2} />}
            onPress={onChallenge}
            testID="friend-profile-challenge"
          />
        </View>
      )}
    </View>
  );
}

function HeroChips({ profile, isBuddy }: { profile: FriendProfilePayload; isBuddy: boolean }) {
  const { t } = useTranslation();
  const tags = (profile.identity_tags ?? []).slice(0, 2);
  const statusLabel = profile.streak_status_label?.trim();
  if (!statusLabel && tags.length === 0 && !isBuddy) return null;
  return (
    <View style={styles.chipRow}>
      {isBuddy ? (
        <View style={[styles.chip, styles.chipAccent]}>
          <Text style={styles.chipText}>{t("friendProfile.buddyChip")}</Text>
        </View>
      ) : null}
      {statusLabel ? (
        <View style={styles.chip}>
          <Text style={styles.chipText}>
            {profile.streak_status_emoji ?? "🌱"} {statusLabel}
          </Text>
        </View>
      ) : null}
      {tags.map((tag) => (
        <View key={tag} style={styles.chip}>
          <Text style={styles.chipText}>{identityTagLabel(tag, t)}</Text>
        </View>
      ))}
    </View>
  );
}
