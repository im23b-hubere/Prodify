import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActivityHeatmapCard } from "../../components/profile/ActivityHeatmapCard";
import { useProfileData } from "../../features/profile/hooks/useProfileData";
import { useProfileAccountActions } from "../../features/profile/hooks/useProfileAccountActions";
import { useProfilePushTest } from "../../features/profile/hooks/useProfilePushTest";
import { profileScreenStyles as styles } from "../../features/profile/profileScreen.styles";
import { ProgressionBarCard } from "../../components/progression/ProgressionBarCard";
import { BadgeIcon } from "../../components/ui/BadgeIcon";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { RankHudChip } from "../../components/progression/RankHudChip";
import { ErrorState } from "../../components/states/ErrorState";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { TextButton } from "../../components/ui/TextButton";
import { AppFlame, glyphRowStyle } from "../../components/icons/ProdifyGlyphs";
import { StatCard } from "../../components/ui/StatCard";
import { API_BASE_URL } from "../../constants/api";
import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { progressionOverviewHref } from "../../lib/progressionNavigation";

function formatHours(totalSeconds: number): string {
  const h = totalSeconds / 3600;
  if (h < 10) return h.toFixed(1);
  return Math.round(h).toString();
}

function ProfileSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonHero}>
        <View style={styles.skeletonAvatar} />
        <View style={[styles.skeletonLine, { width: 140, height: 18 }]} />
        <View style={[styles.skeletonLine, { width: 180, height: 12 }]} />
      </View>
      <View style={styles.skeletonGrid}>
        {[0, 1, 2, 3].map((idx) => (
          <View key={`profile-sk-${idx}`} style={styles.skeletonStat}>
            <View style={[styles.skeletonLine, { width: "55%", height: 12 }]} />
            <View style={[styles.skeletonLine, { width: "70%", height: 22 }]} />
          </View>
        ))}
      </View>
      <View style={styles.skeletonCard}>
        <View style={[styles.skeletonLine, { width: "36%", height: 14 }]} />
        <View style={[styles.skeletonLine, { width: "92%", height: 12 }]} />
        <View style={[styles.skeletonLine, { width: "84%", height: 12 }]} />
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, signOut, deleteAccount, token } = useAuth();
  const router = useRouter();
  const {
    stats,
    milestones,
    reliability,
    heatmapDays,
    progression,
    loading,
    refreshing,
    error,
    load,
    refresh: onRefresh,
  } = useProfileData(token);
  const { confirmSignOut, confirmDeleteAccount } = useProfileAccountActions({
    signOut,
    deleteAccount,
  });
  const {
    busy: pushBusy,
    template: pingTemplate,
    selectTemplate: selectPingTemplate,
    send: pingPush,
  } = useProfilePushTest(token);

  const summary = stats?.summary;
  const showInitialLoading = loading && !refreshing && !summary && !error;
  const avatarUri = user?.profile_picture_url?.trim()
    ? user.profile_picture_url.startsWith("http")
      ? user.profile_picture_url
      : `${API_BASE_URL}${user.profile_picture_url}`
    : null;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="profile-screen">
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
        <ScreenHeader
          title={t("tabs.profile")}
          subtitle={t("profile.identitySubtitle")}
          actionNode={<RankHudChip from="profile" />}
        />
        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {user?.username?.slice(0, 2).toUpperCase() ?? t("profile.defaultInitials")}
              </Text>
            )}
          </View>
          <Text style={styles.username}>{user?.username ?? t("profile.defaultDisplayName")}</Text>
          {user?.email ? (
            <Text style={styles.email}>{user.email}</Text>
          ) : (
            <View style={[styles.skeletonLine, styles.emailSkeleton]} />
          )}
          {user?.id ? (
            <TextButton
              label={t("profile.viewPublicProfile")}
              onPress={() => router.push(`/profile/${user.id}`)}
              subdued
            />
          ) : null}
        </View>

        {showInitialLoading ? <ProfileSkeleton /> : null}

        {!showInitialLoading && error && !summary ? (
          <ErrorState
            title={t("common.oops")}
            message={error}
            retryLabel={t("profile.tryAgain")}
            onRetry={() => void load({ force: true })}
          />
        ) : null}

        {!showInitialLoading && error && summary ? (
          <View style={styles.partialError}>
            <Text style={styles.partialErrorText}>{error}</Text>
          </View>
        ) : null}

        {!showInitialLoading && summary ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitleInline}>{t("profile.producerSnapshotTitle")}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("profile.fullStatsLink")}
                style={({ pressed }) => [styles.sectionLinkBtn, pressed && styles.pressed]}
                onPress={() => router.push("/(tabs)/stats")}
              >
                <Text style={styles.sectionLink}>{t("profile.fullStatsLink")}</Text>
              </Pressable>
            </View>
            <View style={styles.statsGrid}>
              <StatCard label={t("profile.totalSessions")} value={summary.total_sessions} />
              <StatCard
                label={t("profile.currentStreak")}
                value={
                  <View style={glyphRowStyle}>
                    <AppFlame size={18} />
                    <Text style={styles.streakStatValue}>{summary.current_streak_days}</Text>
                  </View>
                }
              />
              <StatCard
                label={t("profile.bestStreak")}
                value={t("profile.bestStreakDays", { days: summary.best_streak_days })}
              />
              <StatCard
                label={t("profile.totalHours")}
                value={formatHours(summary.total_seconds)}
              />
            </View>

            {reliability ? (
              <View style={styles.reliabilityCard}>
                <View style={styles.reliabilityHead}>
                  <Text style={styles.reliabilityLabel}>{t("profile.reliabilityTitle")}</Text>
                  <Text style={styles.reliabilityTrend}>
                    {reliability.trend === "up"
                      ? t("profile.reliabilityTrendUp")
                      : reliability.trend === "down"
                        ? t("profile.reliabilityTrendDown")
                        : t("profile.reliabilityTrendStable")}
                  </Text>
                </View>
                <Text style={styles.reliabilityScore}>{reliability.score.toFixed(1)}/10</Text>
                <Text style={styles.reliabilityMeta}>
                  {typeof reliability.rank_percent === "number"
                    ? t("profile.reliabilityRank", { rank: reliability.rank_percent })
                    : t("profile.reliabilityRankUnavailable")}
                </Text>
                <Text style={styles.reliabilityHint}>
                  {t("profile.reliabilityHint", {
                    consistency: Math.round(Number(reliability.consistency_90d) || 0),
                    completion: Math.round(Number(reliability.completion_rate_90d) || 0),
                  })}
                </Text>
              </View>
            ) : null}

            <ProgressionBarCard
              progression={progression}
              onPress={() => router.push(progressionOverviewHref("profile"))}
            />

            <View style={styles.heatmapBlock}>
              <ActivityHeatmapCard days={heatmapDays} />
            </View>
          </>
        ) : null}

        {!showInitialLoading ? (
          <>
            <Text style={styles.sectionTitle}>{t("profile.milestonesTitle")}</Text>
            {milestones ? (
              <Text style={styles.milestoneSub}>
                {t("profile.milestoneSub", { days: milestones.longest_streak_days })}
              </Text>
            ) : null}

            {milestones ? (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.badgesRow}
              >
                {milestones.milestones.map((item) => (
                  <BadgeIcon key={item.days} label={item.title} unlocked={item.unlocked} />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.muted}>{t("profile.milestonesUnavailable")}</Text>
            )}
          </>
        ) : null}

        {__DEV__ ? (
          <>
            <Text style={styles.sectionTitle}>{t("profile.pushSectionTitle")}</Text>
            <Text style={styles.pushHint}>{t("profile.pushHint")}</Text>
            <View style={styles.pingChips}>
              {(
                [
                  { id: "test" as const, labelKey: "profile.pingTemplateTest" as const },
                  { id: "session_demo" as const, labelKey: "profile.pingTemplateSession" as const },
                  { id: "streak_demo" as const, labelKey: "profile.pingTemplateStreak" as const },
                ] as const
              ).map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.pingChip, pingTemplate === p.id && styles.pingChipOn]}
                  onPress={() => {
                    selectPingTemplate(p.id);
                  }}
                >
                  <Text style={[styles.pingChipTxt, pingTemplate === p.id && styles.pingChipTxtOn]}>
                    {t(p.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton
              label={pushBusy ? t("profile.pingSending") : t("profile.pingSend")}
              onPress={pingPush}
              loading={pushBusy}
            />
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{t("profile.settingsTitle")}</Text>
        <View style={styles.settingsCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.manageNotifications")}
            style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
            onPress={() =>
              router.push({ pathname: "/notifications", params: { source: "profile" } })
            }
          >
            <Text style={styles.legalRowText}>{t("profile.manageNotifications")}</Text>
            <Text style={styles.legalRowChevron}>›</Text>
          </Pressable>
          <View style={styles.legalDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("legal.linksPrivacy")}
            style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
            onPress={() => router.push("/legal/privacy" as never)}
          >
            <Text style={styles.legalRowText}>{t("legal.linksPrivacy")}</Text>
            <Text style={styles.legalRowChevron}>›</Text>
          </Pressable>
          <View style={styles.legalDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("legal.linksTerms")}
            style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
            onPress={() => router.push("/legal/terms" as never)}
          >
            <Text style={styles.legalRowText}>{t("legal.linksTerms")}</Text>
            <Text style={styles.legalRowChevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.deleteSection}>
          <Text style={styles.deleteSectionTitle}>{t("legal.deleteAccount.sectionTitle")}</Text>
          <Text style={styles.deleteDesc}>{t("legal.deleteAccount.description")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("legal.deleteAccount.button")}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            onPress={confirmDeleteAccount}
          >
            <Text style={styles.deleteBtnText}>{t("legal.deleteAccount.button")}</Text>
          </Pressable>
        </View>

        <View style={styles.signoutWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.signOut")}
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
            onPress={confirmSignOut}
          >
            <Text style={styles.outlineBtnText}>{t("profile.signOut")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
