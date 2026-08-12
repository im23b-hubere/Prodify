import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AchievementGlyph, glyphRowStyle } from "../../components/icons/ProdifyGlyphs";
import { ActivityHeatmapCard } from "../../components/profile/ActivityHeatmapCard";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { StreakComparison } from "../../components/profile/StreakComparison";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { colors } from "../../constants/theme";
import { friendProfileStyles as styles } from "../../features/profile/friendProfile.styles";
import { useFriendProfile } from "../../features/profile/hooks/useFriendProfile";
import {
  parseProfileUserId,
  profilePictureUrl as resolveProfilePictureUrl,
  translatedWeekday,
} from "../../features/profile/friendProfilePresentation";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { formatDurationWords, formatSessionListDate } from "../../lib/sessionTime";

export default function FriendProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const userId = parseProfileUserId(idStr);

  const {
    status,
    targetUsername,
    pendingDirection,
    profile,
    stats,
    sessions,
    yourStreak,
    loadState,
    error,
    buddyStatus,
    socialRecap,
    refreshing,
    isOwnProfile,
    load,
    refresh,
  } = useFriendProfile(userId);
  const bestDayLabel = translatedWeekday(stats?.best_day, t);

  const goBack = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    router.back();
  }, [router]);

  const loadingMessage = isOwnProfile
    ? t("friendProfile.loadingOwnProfile")
    : t("friendProfile.loadingProfile");

  if (loadState === "loading" && !refreshing) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendProfile.backA11y")}
            onPress={goBack}
            hitSlop={12}
          >
            <Text style={styles.back}>{t("friendProfile.backArrow")}</Text>
          </Pressable>
        </View>
        <View style={styles.bootWrap}>
          <LoadingState message={loadingMessage} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === "error") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendProfile.backA11y")}
            onPress={goBack}
            hitSlop={12}
          >
            <Text style={styles.back}>{t("friendProfile.backArrow")}</Text>
          </Pressable>
        </View>
        <View style={styles.bootWrap}>
          <ErrorState
            title={t("friendProfile.couldNotLoadTitle")}
            message={error ?? t("friendProfile.loadError")}
            retryLabel={t("friendProfile.retry")}
            onRetry={() => void load()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendProfile.backA11y")}
            style={styles.bootBackBtn}
            onPress={goBack}
          >
            <Text style={styles.bootBackTxt}>{t("friendProfile.back")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const locked = status === "none" || status === "pending";
  const profilePictureUrl = resolveProfilePictureUrl(profile?.profile_picture_url);

  const lockedSub =
    status === "pending"
      ? pendingDirection === "incoming"
        ? t("friendProfile.lockedPendingIncoming")
        : t("friendProfile.lockedPendingOutgoing")
      : t("friendProfile.lockedNone");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("friendProfile.backA11y")}
          onPress={goBack}
          hitSlop={12}
        >
          <Text style={styles.back}>{t("friendProfile.backArrow")}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        {locked ? (
          <View style={styles.locked}>
            <Text style={styles.lockedMainTitle}>
              {targetUsername
                ? t("friendProfile.lockedUserHeading", { name: targetUsername })
                : t("friendProfile.lockedTitle")}
            </Text>
            <Text style={styles.lockedSub}>{lockedSub}</Text>
            <PrimaryButton
              label={t("friendProfile.friendsTab")}
              onPress={() => router.push("/(tabs)/friends")}
            />
          </View>
        ) : profile && stats ? (
          <>
            <ProfileHeader
              username={profile.username}
              totalSessions={profile.total_sessions}
              currentStreak={profile.current_streak}
              friendsCount={profile.friends_count}
              status={status === "self" ? "self" : "accepted"}
              identityTags={profile.identity_tags ?? []}
              streakStatusLabel={profile.streak_status_label}
              streakStatusEmoji={profile.streak_status_emoji}
              profilePictureUrl={profilePictureUrl}
            />

            {status !== "self" ? (
              <View style={styles.block}>
                <StreakComparison yourStreak={yourStreak} theirStreak={stats.current_streak} />
              </View>
            ) : null}

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>{t("friendProfile.reliabilityTitle")}</Text>
              <Text style={styles.lineStrong}>
                {(profile.reliability_score ?? 0).toFixed(1)}
                /10
              </Text>
              <Text style={styles.line}>
                {typeof profile.reliability_rank_percent === "number"
                  ? t("friendProfile.reliabilityRank", {
                      rank: profile.reliability_rank_percent,
                    })
                  : t("friendProfile.reliabilityRankUnavailable")}
              </Text>
              <Text style={styles.line}>
                {profile.reliability_trend === "up"
                  ? t("friendProfile.reliabilityTrendUp")
                  : profile.reliability_trend === "down"
                    ? t("friendProfile.reliabilityTrendDown")
                    : t("friendProfile.reliabilityTrendStable")}
              </Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>{t("friendProfile.overview")}</Text>
              <Text style={styles.line}>
                {t("friendProfile.totalTime", { hours: stats.total_hours })}
              </Text>
              <Text style={styles.line}>
                {t("friendProfile.sessionsLine", { count: stats.total_sessions })}
              </Text>
              {stats.best_day && bestDayLabel ? (
                <Text style={styles.line}>
                  {t("friendProfile.bestDay", { date: bestDayLabel })}
                </Text>
              ) : null}
              <Text style={styles.line}>
                {buddyStatus?.buddy_user_id === profile.id
                  ? t("friendProfile.activeBuddy")
                  : t("friendProfile.socialFriend")}
              </Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>{t("friendProfile.sharedMomentumTitle")}</Text>
              <Text style={styles.line}>
                {t("friendProfile.creativeRunLine", {
                  yours: yourStreak,
                  theirs: stats.current_streak,
                })}
              </Text>
              {status === "self" ? (
                <>
                  <Text style={styles.line}>
                    {socialRecap
                      ? t("friendProfile.teamSessionsLine", {
                          sessions: socialRecap.team_sessions,
                          sign: socialRecap.wow_delta_sessions >= 0 ? "+" : "",
                          wow: socialRecap.wow_delta_sessions,
                        })
                      : t("friendProfile.comparisonHint")}
                  </Text>
                  {socialRecap?.identity_tag ? (
                    <Text style={styles.lineStrong}>
                      {t(`friendsScreen.identityTag.${socialRecap.identity_tag}`)}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.lineMuted}>
                    {t("friendProfile.sharedMomentumFriendHint")}
                  </Text>
                  <Text style={styles.line}>{t("friendProfile.comparisonHint")}</Text>
                </>
              )}
            </View>

            <View style={styles.block}>
              <ActivityHeatmapCard days={stats.heatmap_days} />
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>{t("friendProfile.achievementsTitle")}</Text>
              {stats.achievements.length === 0 ? (
                <Text style={styles.muted}>{t("friendProfile.noneUnlocked")}</Text>
              ) : (
                stats.achievements.map((a) => {
                  const title = t(`friendProfile.achievements.${a.id}`, { defaultValue: a.id });
                  return (
                    <View key={a.id} style={[glyphRowStyle, styles.achRow]}>
                      <AchievementGlyph achievementId={a.id} size={18} />
                      <Text style={styles.ach}>{title}</Text>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>{t("friendProfile.recentSessions")}</Text>
              {sessions.length === 0 ? (
                <Text style={styles.muted}>{t("friendProfile.noSessionsYet")}</Text>
              ) : (
                sessions.map((s) => (
                  <Pressable
                    key={s.id}
                    accessibilityRole="button"
                    accessibilityLabel={t("friendProfile.openSessionA11y", {
                      type: sessionTypeLabel(s.session_type, t),
                    })}
                    style={({ pressed }) => [styles.sessRow, pressed && styles.sessRowPressed]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => undefined);
                      router.push({
                        pathname: "/session/[id]",
                        params: { id: String(s.id), ownerName: profile.username },
                      } as Href);
                    }}
                  >
                    <View style={styles.sessCol}>
                      <Text style={styles.sessType}>{sessionTypeLabel(s.session_type, t)}</Text>
                      <Text style={styles.sessDate}>{formatSessionListDate(s.started_at)}</Text>
                    </View>
                    <Text style={styles.sessMeta}>{formatDurationWords(s.duration_seconds)}</Text>
                  </Pressable>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
