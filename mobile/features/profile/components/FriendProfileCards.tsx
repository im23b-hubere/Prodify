import type { TFunction } from "i18next";
import { Pressable, Text, View } from "react-native";

import { AchievementGlyph, glyphRowStyle } from "../../../components/icons/ProdifyGlyphs";
import type {
  FriendProfilePayload,
  FriendSessionItem,
  FriendStatsPayload,
} from "../hooks/useFriendProfile";
import type { BuddyStatusDto, SocialRecapDto } from "../../../types/friends";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { formatDurationWords, formatSessionListDate } from "../../../lib/sessionTime";
import { friendProfileStyles as styles } from "../friendProfile.styles";

export function ReliabilityCard({ profile, t }: { profile: FriendProfilePayload; t: TFunction }) {
  const trendKey =
    profile.reliability_trend === "up"
      ? "friendProfile.reliabilityTrendUp"
      : profile.reliability_trend === "down"
        ? "friendProfile.reliabilityTrendDown"
        : "friendProfile.reliabilityTrendStable";
  return (
    <View style={styles.statsCard}>
      <Text style={styles.cardTitle}>{t("friendProfile.reliabilityTitle")}</Text>
      <Text style={styles.lineStrong}>{(profile.reliability_score ?? 0).toFixed(1)}/10</Text>
      <Text style={styles.line}>
        {typeof profile.reliability_rank_percent === "number"
          ? t("friendProfile.reliabilityRank", { rank: profile.reliability_rank_percent })
          : t("friendProfile.reliabilityRankUnavailable")}
      </Text>
      <Text style={styles.line}>{t(trendKey)}</Text>
    </View>
  );
}

export function OverviewCard({
  profile,
  stats,
  bestDayLabel,
  buddyStatus,
  t,
}: {
  profile: FriendProfilePayload;
  stats: FriendStatsPayload;
  bestDayLabel: string | null;
  buddyStatus: BuddyStatusDto | null;
  t: TFunction;
}) {
  return (
    <View style={styles.statsCard}>
      <Text style={styles.cardTitle}>{t("friendProfile.overview")}</Text>
      <Text style={styles.line}>{t("friendProfile.totalTime", { hours: stats.total_hours })}</Text>
      <Text style={styles.line}>
        {t("friendProfile.sessionsLine", { count: stats.total_sessions })}
      </Text>
      {stats.best_day && bestDayLabel ? (
        <Text style={styles.line}>{t("friendProfile.bestDay", { date: bestDayLabel })}</Text>
      ) : null}
      <Text style={styles.line}>
        {buddyStatus?.buddy_user_id === profile.id
          ? t("friendProfile.activeBuddy")
          : t("friendProfile.socialFriend")}
      </Text>
    </View>
  );
}

export function SharedMomentumCard({
  isOwnProfile,
  yourStreak,
  theirStreak,
  socialRecap,
  t,
}: {
  isOwnProfile: boolean;
  yourStreak: number;
  theirStreak: number;
  socialRecap: SocialRecapDto | null;
  t: TFunction;
}) {
  return (
    <View style={styles.statsCard}>
      <Text style={styles.cardTitle}>{t("friendProfile.sharedMomentumTitle")}</Text>
      <Text style={styles.line}>
        {t("friendProfile.creativeRunLine", { yours: yourStreak, theirs: theirStreak })}
      </Text>
      {isOwnProfile ? (
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
          <Text style={styles.lineMuted}>{t("friendProfile.sharedMomentumFriendHint")}</Text>
          <Text style={styles.line}>{t("friendProfile.comparisonHint")}</Text>
        </>
      )}
    </View>
  );
}

export function AchievementsCard({ stats, t }: { stats: FriendStatsPayload; t: TFunction }) {
  return (
    <View style={styles.statsCard}>
      <Text style={styles.cardTitle}>{t("friendProfile.achievementsTitle")}</Text>
      {stats.achievements.length === 0 ? (
        <Text style={styles.muted}>{t("friendProfile.noneUnlocked")}</Text>
      ) : (
        stats.achievements.map((achievement) => (
          <View key={achievement.id} style={[glyphRowStyle, styles.achRow]}>
            <AchievementGlyph achievementId={achievement.id} size={18} />
            <Text style={styles.ach}>
              {t(`friendProfile.achievements.${achievement.id}`, { defaultValue: achievement.id })}
            </Text>
          </View>
        ))
      )}
    </View>
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
  return (
    <View style={styles.statsCard}>
      <Text style={styles.cardTitle}>{t("friendProfile.recentSessions")}</Text>
      {sessions.length === 0 ? (
        <Text style={styles.muted}>{t("friendProfile.noSessionsYet")}</Text>
      ) : (
        sessions.map((session) => (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            accessibilityLabel={t("friendProfile.openSessionA11y", {
              type: sessionTypeLabel(session.session_type, t),
            })}
            style={({ pressed }) => [styles.sessRow, pressed && styles.sessRowPressed]}
            onPress={() => onOpenSession(session.id, ownerName)}
          >
            <View style={styles.sessCol}>
              <Text style={styles.sessType}>{sessionTypeLabel(session.session_type, t)}</Text>
              <Text style={styles.sessDate}>{formatSessionListDate(session.started_at)}</Text>
            </View>
            <Text style={styles.sessMeta}>{formatDurationWords(session.duration_seconds)}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
