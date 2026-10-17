import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  AchievementGlyph,
  AppFlame,
  glyphRowStyle,
  isMoodLevel,
  MoodIcon,
} from "../../../components/icons/ProdifyGlyphs";
import { StatCard } from "../../../components/ui/StatCard";
import { SESSION_TYPES } from "../../../constants/sessionTypes";
import { colors } from "../../../constants/theme";
import { normalizeSessionTypeId, sessionTypeLabel } from "../../../lib/sessionI18n";
import { formatDurationWords, formatSessionListDate } from "../../../lib/sessionTime";
import type { FriendCommitmentDto } from "../../../types/friends";
import {
  achievementShowcase,
  focusSlices,
  OTHER_FOCUS_TYPE,
} from "../friendProfilePresentation";
import { friendProfileStyles as styles } from "../friendProfile.styles";
import type {
  FriendProfilePayload,
  FriendSessionItem,
  FriendStatsPayload,
} from "../hooks/useFriendProfile";

const RECENT_SESSION_LIMIT = 5;
const OTHER_FOCUS_COLOR = "#3a3a3a";

const RELIABILITY_TREND_KEYS = {
  up: "friendProfile.reliabilityTrendUp",
  down: "friendProfile.reliabilityTrendDown",
  stable: "friendProfile.reliabilityTrendStable",
} as const;

function sessionTypeColor(type: string): string {
  const id = normalizeSessionTypeId(type);
  return SESSION_TYPES.find((sessionType) => sessionType.id === id)?.color ?? colors.textSecondary;
}

export function ProfileSection({
  title,
  meta,
  children,
  testID,
}: {
  title: string;
  meta?: string | null;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ConsistencyValue({ score }: { score: number }) {
  const fill = `${Math.min(100, Math.max(0, score * 10))}%` as const;
  return (
    <View style={styles.consistencyValue}>
      <Text style={styles.commitmentCount}>{`${score.toFixed(1)}/10`}</Text>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: fill }]} />
      </View>
    </View>
  );
}

export function FriendStatsGrid({
  profile,
  stats,
  showTotals,
  t,
}: {
  profile: FriendProfilePayload;
  stats: FriendStatsPayload;
  /** Totals are already shown head-to-head on a friend's profile, so only repeat them otherwise. */
  showTotals: boolean;
  t: TFunction;
}) {
  const trend = profile.reliability_trend ?? "stable";
  return (
    <View style={styles.statsGrid} testID="friend-profile-stats">
      {showTotals ? (
        <>
          <StatCard
            label={t("friendProfile.currentStreakLabel")}
            value={
              <View style={glyphRowStyle}>
                <AppFlame size={18} />
                <Text style={styles.commitmentCount}>{stats.current_streak}</Text>
              </View>
            }
          />
          <StatCard label={t("friendProfile.sessionsLabel")} value={stats.total_sessions} />
          <StatCard
            label={t("friendProfile.totalHoursLabel")}
            value={t("friendProfile.hoursValue", { hours: stats.total_hours })}
          />
        </>
      ) : null}
      <StatCard
        label={t("friendProfile.bestStreakLabel")}
        value={t("friendProfile.daysValue", { count: stats.longest_streak })}
      />
      <StatCard
        label={t("friendProfile.reliabilityTitle")}
        value={<ConsistencyValue score={profile.reliability_score ?? 0} />}
        sublabel={t(RELIABILITY_TREND_KEYS[trend])}
        subPositive={trend !== "down"}
      />
    </View>
  );
}

export function CommitmentCard({ commitment, t }: { commitment: FriendCommitmentDto; t: TFunction }) {
  const { current_sessions: current, target_sessions: target, status } = commitment;
  const progress = t("friendProfile.commitmentProgress", { current, count: target });
  const statusLabel = t(`friendProfile.commitmentStatus.${status}`);
  const fillPercent = `${Math.min(100, Math.round((current / Math.max(1, target)) * 100))}%` as const;
  const isDone = status === "completed";
  return (
    <ProfileSection title={t("friendProfile.commitmentTitle")}>
      <View
        style={styles.card}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("friendProfile.commitmentA11y", { progress, status: statusLabel })}
        accessibilityValue={{ min: 0, max: target, now: Math.min(current, target) }}
        testID="friend-profile-commitment"
      >
        <View style={styles.commitmentHeader}>
          <Text style={styles.commitmentCount}>{progress}</Text>
          <Text
            style={[
              styles.commitmentStatus,
              status === "behind" && styles.commitmentStatusBehind,
              isDone && styles.commitmentStatusDone,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: fillPercent }, isDone && styles.progressFillDone]} />
        </View>
      </View>
    </ProfileSection>
  );
}

export function FocusCard({
  breakdown,
  bestDayLabel,
  t,
}: {
  breakdown: Record<string, number>;
  bestDayLabel: string | null;
  t: TFunction;
}) {
  const slices = focusSlices(breakdown);
  const label = (type: string) =>
    type === OTHER_FOCUS_TYPE ? t("friendProfile.focusOther") : sessionTypeLabel(type, t);
  const color = (type: string) => (type === OTHER_FOCUS_TYPE ? OTHER_FOCUS_COLOR : sessionTypeColor(type));
  return (
    <ProfileSection
      title={t("friendProfile.focusTitle")}
      meta={bestDayLabel ? t("friendProfile.focusBestDay", { day: bestDayLabel }) : null}
      testID="friend-profile-focus"
    >
      <View style={styles.card}>
        {slices.length === 0 ? (
          <Text style={styles.muted}>{t("friendProfile.focusEmpty")}</Text>
        ) : (
          <>
            <View style={styles.focusBar} accessible={false}>
              {slices.map((slice) => (
                <View
                  key={slice.type}
                  style={[styles.focusSegment, { flex: slice.share, backgroundColor: color(slice.type) }]}
                />
              ))}
            </View>
            {slices.map((slice) => (
              <View key={slice.type} style={styles.focusLegendRow}>
                <View style={[styles.focusDot, { backgroundColor: color(slice.type) }]} />
                <Text style={styles.focusLabel}>{label(slice.type)}</Text>
                <Text style={styles.focusShare}>{`${Math.round(slice.share * 100)}%`}</Text>
              </View>
            ))}
          </>
        )}
      </View>
    </ProfileSection>
  );
}

export function AchievementsRow({ stats, t }: { stats: FriendStatsPayload; t: TFunction }) {
  const items = achievementShowcase(stats.achievements);
  const unlockedCount = items.filter((item) => item.unlocked).length;
  return (
    <ProfileSection
      title={t("friendProfile.achievementsTitle")}
      meta={t("friendProfile.achievementsCount", { unlocked: unlockedCount, total: items.length })}
    >
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.achievementsRow}
      >
        {items.map((item) => {
          const name = t(`friendProfile.achievements.${item.id}`, { defaultValue: item.id });
          return (
            <View
              key={item.id}
              accessible
              accessibilityLabel={t(
                item.unlocked ? "friendProfile.achievementUnlockedA11y" : "friendProfile.achievementLockedA11y",
                { name },
              )}
              style={[styles.achievement, item.unlocked ? styles.achievementUnlocked : styles.achievementLocked]}
            >
              <AchievementGlyph
                achievementId={item.id}
                size={22}
                color={item.unlocked ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.achievementLabel} numberOfLines={2}>
                {name}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </ProfileSection>
  );
}

function SessionRow({
  session,
  onPress,
  t,
}: {
  session: FriendSessionItem;
  onPress: () => void;
  t: TFunction;
}) {
  const typeLabel = sessionTypeLabel(session.session_type, t);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("friendProfile.openSessionA11y", { type: typeLabel })}
      style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={[styles.sessionAccent, { backgroundColor: sessionTypeColor(session.session_type) }]} />
      <View style={styles.sessionText}>
        <Text style={styles.sessionType}>{typeLabel}</Text>
        <Text style={styles.sessionDate}>{formatSessionListDate(session.started_at)}</Text>
      </View>
      {session.mood_level != null && isMoodLevel(session.mood_level) ? (
        <MoodIcon level={session.mood_level} size={16} />
      ) : null}
      <Text style={styles.sessionDuration}>
        {formatDurationWords(session.duration_seconds, t)}
      </Text>
    </Pressable>
  );
}

export function RecentSessionsCard({
  sessions,
  ownerName,
  onOpenSession,
  t,
}: {
  sessions: FriendSessionItem[];
  ownerName: string;
  onOpenSession: (id: number, ownerName: string) => void;
  t: TFunction;
}) {
  const visible = sessions.slice(0, RECENT_SESSION_LIMIT);
  return (
    <ProfileSection title={t("friendProfile.recentSessions")}>
      <View style={styles.card}>
        {visible.length === 0 ? (
          <Text style={styles.muted}>{t("friendProfile.noSessionsYet")}</Text>
        ) : (
          visible.map((session, index) => (
            <View key={session.id}>
              {index > 0 ? <View style={styles.sessionDivider} /> : null}
              <SessionRow session={session} onPress={() => onOpenSession(session.id, ownerName)} t={t} />
            </View>
          ))
        )}
      </View>
    </ProfileSection>
  );
}
