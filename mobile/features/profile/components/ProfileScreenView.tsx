import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppFlame, glyphRowStyle } from "../../../components/icons/ProdifyGlyphs";
import { ActivityHeatmapCard } from "../../../components/profile/ActivityHeatmapCard";
import { ProgressionBarCard } from "../../../components/progression/ProgressionBarCard";
import { RankHudChip } from "../../../components/progression/RankHudChip";
import { ErrorState } from "../../../components/states/ErrorState";
import { BadgeIcon } from "../../../components/ui/BadgeIcon";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { ScreenHeader } from "../../../components/ui/ScreenHeader";
import { StatCard } from "../../../components/ui/StatCard";
import { TextButton } from "../../../components/ui/TextButton";
import { API_BASE_URL } from "../../../constants/api";
import { colors } from "../../../constants/theme";
import { profileScreenStyles as styles } from "../profileScreen.styles";
import type { ProfileScreenController } from "../hooks/useProfileScreenController";
import { ProfileSettingsSection } from "./ProfileSettingsSection";

type Props = { controller: ProfileScreenController };

function formatHours(totalSeconds: number): string {
  const hours = totalSeconds / 3600;
  return hours < 10 ? hours.toFixed(1) : Math.round(hours).toString();
}

function avatarUri(path?: string | null): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `${API_BASE_URL}${trimmed}`;
}

function identityPresentation(controller: ProfileScreenController) {
  const { t, user } = controller;
  return {
    imageUri: avatarUri(user?.profile_picture_url),
    initials: user?.username?.slice(0, 2).toUpperCase() ?? t("profile.defaultInitials"),
    username: user?.username ?? t("profile.defaultDisplayName"),
    email: user?.email ?? null,
    hasPublicProfile: Boolean(user?.id),
  };
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
        {[0, 1, 2, 3].map((index) => (
          <View key={`profile-sk-${index}`} style={styles.skeletonStat}>
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

function ProfileIdentity({ controller }: Props) {
  const { t, navigation } = controller;
  const identity = identityPresentation(controller);
  return (
    <View style={styles.profileHero}>
      <View style={styles.avatar}>
        {identity.imageUri ? (
          <Image source={{ uri: identity.imageUri }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{identity.initials}</Text>
        )}
      </View>
      <Text style={styles.username}>{identity.username}</Text>
      {identity.email ? (
        <Text style={styles.email}>{identity.email}</Text>
      ) : (
        <View style={[styles.skeletonLine, styles.emailSkeleton]} />
      )}
      {identity.hasPublicProfile ? (
        <TextButton
          label={t("profile.viewPublicProfile")}
          onPress={navigation.openPublicProfile}
          subdued
        />
      ) : null}
    </View>
  );
}

function ReliabilityCard({ controller }: Props) {
  const { t } = controller;
  const reliability = controller.data.reliability;
  if (!reliability) return null;
  const trendKey = {
    up: "profile.reliabilityTrendUp",
    down: "profile.reliabilityTrendDown",
    stable: "profile.reliabilityTrendStable",
  }[reliability.trend];
  const rank =
    typeof reliability.rank_percent === "number"
      ? t("profile.reliabilityRank", { rank: reliability.rank_percent })
      : t("profile.reliabilityRankUnavailable");
  return (
    <View style={styles.reliabilityCard}>
      <View style={styles.reliabilityHead}>
        <Text style={styles.reliabilityLabel}>{t("profile.reliabilityTitle")}</Text>
        <Text style={styles.reliabilityTrend}>{t(trendKey)}</Text>
      </View>
      <Text style={styles.reliabilityScore}>{reliability.score.toFixed(1)}/10</Text>
      <Text style={styles.reliabilityMeta}>{rank}</Text>
      <Text style={styles.reliabilityHint}>
        {t("profile.reliabilityHint", {
          consistency: Math.round(Number(reliability.consistency_90d) || 0),
          completion: Math.round(Number(reliability.completion_rate_90d) || 0),
        })}
      </Text>
    </View>
  );
}

function ProducerSnapshot({ controller }: Props) {
  const { t, data, navigation } = controller;
  const summary = data.stats?.summary;
  if (!summary) return null;
  return (
    <>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitleInline}>{t("profile.producerSnapshotTitle")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("profile.fullStatsLink")}
          style={({ pressed }) => [styles.sectionLinkBtn, pressed && styles.pressed]}
          onPress={navigation.openStats}
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
        <StatCard label={t("profile.totalHours")} value={formatHours(summary.total_seconds)} />
      </View>
      <ReliabilityCard controller={controller} />
      <ProgressionBarCard progression={data.progression} onPress={navigation.openProgression} />
      <View style={styles.heatmapBlock}>
        <ActivityHeatmapCard days={data.heatmapDays} />
      </View>
    </>
  );
}

function MilestonesSection({ controller }: Props) {
  const { t, data } = controller;
  return (
    <>
      <Text style={styles.sectionTitle}>{t("profile.milestonesTitle")}</Text>
      {data.milestones ? (
        <>
          <Text style={styles.milestoneSub}>
            {t("profile.milestoneSub", { days: data.milestones.longest_streak_days })}
          </Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesRow}
          >
            {data.milestones.milestones.map((item) => (
              <BadgeIcon key={item.days} label={item.title} unlocked={item.unlocked} />
            ))}
          </ScrollView>
        </>
      ) : (
        <Text style={styles.muted}>{t("profile.milestonesUnavailable")}</Text>
      )}
    </>
  );
}

const PUSH_TEMPLATES = [
  { id: "test" as const, labelKey: "profile.pingTemplateTest" as const },
  { id: "session_demo" as const, labelKey: "profile.pingTemplateSession" as const },
  { id: "streak_demo" as const, labelKey: "profile.pingTemplateStreak" as const },
];

function PushTestSection({ controller }: Props) {
  if (!__DEV__) return null;
  const { t, pushTest } = controller;
  return (
    <>
      <Text style={styles.sectionTitle}>{t("profile.pushSectionTitle")}</Text>
      <Text style={styles.pushHint}>{t("profile.pushHint")}</Text>
      <View style={styles.pingChips}>
        {PUSH_TEMPLATES.map((template) => (
          <Pressable
            key={template.id}
            style={[styles.pingChip, pushTest.template === template.id && styles.pingChipOn]}
            onPress={() => pushTest.selectTemplate(template.id)}
          >
            <Text
              style={[
                styles.pingChipTxt,
                pushTest.template === template.id && styles.pingChipTxtOn,
              ]}
            >
              {t(template.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>
      <PrimaryButton
        label={pushTest.busy ? t("profile.pingSending") : t("profile.pingSend")}
        onPress={pushTest.send}
        loading={pushTest.busy}
      />
    </>
  );
}

function ProfileDataContent({ controller }: Props) {
  const { t, data } = controller;
  const summary = data.stats?.summary;
  const initialLoading = data.loading && !data.refreshing && !summary && !data.error;
  if (initialLoading) return <ProfileSkeleton />;
  if (data.error && !summary) {
    return (
      <>
        <ErrorState
          title={t("common.oops")}
          message={data.error}
          retryLabel={t("profile.tryAgain")}
          onRetry={() => void data.load({ force: true })}
        />
        <MilestonesSection controller={controller} />
      </>
    );
  }
  return (
    <>
      {data.error ? (
        <View style={styles.partialError}>
          <Text style={styles.partialErrorText}>{data.error}</Text>
        </View>
      ) : null}
      <ProducerSnapshot controller={controller} />
      <MilestonesSection controller={controller} />
    </>
  );
}

export function ProfileScreenView({ controller }: Props) {
  const { t, data } = controller;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="profile-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={data.refreshing}
            onRefresh={data.refresh}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader
          title={t("tabs.profile")}
          subtitle={t("profile.identitySubtitle")}
          actionNode={<RankHudChip from="profile" />}
        />
        <ProfileIdentity controller={controller} />
        <ProfileDataContent controller={controller} />
        <PushTestSection controller={controller} />
        <ProfileSettingsSection controller={controller} />
      </ScrollView>
    </SafeAreaView>
  );
}
