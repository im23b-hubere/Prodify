import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { TrendingDown, TrendingUp } from "lucide-react-native";
import { memo, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Avatar } from "../../../../components/ui/Avatar";
import { ListSection } from "../../../../components/ui/list/ListSection";
import { SegmentedControl } from "../../../../components/ui/SegmentedControl";
import { colors } from "../../../../constants/theme";
import type { FriendLeaderboardEntryDto } from "../../../../types/friends";
import { profilePictureUrl } from "../../../profile/friendProfilePresentation";
import { friendsRankingStyles as styles } from "../../styles/friendsRanking.styles";
import { type RankingRow, visibleRanking } from "../friendsRanking";

const AVATAR_SIZE = 40;

type Period = "week" | "all";

type Props = {
  t: TFunction;
  entries: FriendLeaderboardEntryDto[];
  currentUserId: number | undefined;
  period: Period;
  onChangePeriod: (period: Period) => void;
  onOpenProfile: (userId: number) => void;
};

export const RankingSection = memo(function RankingSection({
  t,
  entries,
  currentUserId,
  period,
  onChangePeriod,
  onOpenProfile,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(
    () => visibleRanking(entries, currentUserId, expanded).rows,
    [currentUserId, entries, expanded],
  );
  const isCollapsible = useMemo(
    () => visibleRanking(entries, currentUserId, false).hiddenCount > 0,
    [currentUserId, entries],
  );
  return (
    <ListSection
      title={t("friendsOverview.rankingTitle")}
      testID="friends-ranking"
      right={
        <View style={styles.periodSwitch}>
          <SegmentedControl
            compact
            options={[
              { value: "week", label: t("friendsScreen.modeWeek") },
              { value: "all", label: t("friendsScreen.modeAll") },
            ]}
            value={period}
            onChange={onChangePeriod}
          />
        </View>
      }
    >
      <Animated.View key={period} entering={FadeIn.duration(220)}>
        {rows.map((row, index) => (
          <RankingRowItem
            key={row.entry.user_id}
            t={t}
            row={row}
            isYou={row.entry.user_id === currentUserId}
            divided={index > 0}
            onOpenProfile={onOpenProfile}
          />
        ))}
        {isCollapsible ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.showMore, pressed && styles.rowPressed]}
            onPress={() => setExpanded((value) => !value)}
            testID="friends-ranking-toggle"
          >
            <View style={[styles.rowDivider, styles.showMoreDivider]} />
            <Text style={styles.textActionLabel}>
              {expanded
                ? t("friendsOverview.showLess")
                : t("friendsOverview.showAll", { count: entries.length })}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </ListSection>
  );
});

function RankingRowItem({
  t,
  row,
  isYou,
  divided,
  onOpenProfile,
}: {
  t: TFunction;
  row: RankingRow;
  isYou: boolean;
  divided: boolean;
  onOpenProfile: (userId: number) => void;
}) {
  const { entry, position } = row;
  const streak =
    entry.current_streak_days > 0
      ? t("friendsOverview.streakDays", { count: entry.current_streak_days })
      : t("friendsOverview.noStreak");
  const meta = isYou ? `${t("friendsOverview.you")} · ${streak}` : streak;
  const unit = t("friendsOverview.sessionUnit", { count: entry.sessions_in_period });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("friendsOverview.rankRowA11y", {
        position,
        name: entry.username,
        sessions: `${entry.sessions_in_period} ${unit}`,
        meta,
      })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onOpenProfile(entry.user_id);
      }}
      testID={`friends-rank-${entry.user_id}`}
    >
      {divided ? <View style={[styles.rowDivider, styles.rankDivider]} /> : null}
      <Text style={[styles.rankPosition, isYou && styles.rankPositionYou]}>{position}</Text>
      <Avatar
        name={entry.username}
        photoUri={profilePictureUrl(entry.profile_picture_url)}
        size={AVATAR_SIZE}
        ring={isYou ? "accent" : "none"}
      />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {entry.username}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={styles.rankScore}>
        <View style={styles.rankScoreValueRow}>
          <TrendIcon trend={entry.trend} />
          <Text style={styles.rankScoreValue}>{entry.sessions_in_period}</Text>
        </View>
        <Text style={styles.rankScoreUnit}>{unit}</Text>
      </View>
    </Pressable>
  );
}

function TrendIcon({ trend }: { trend: FriendLeaderboardEntryDto["trend"] }) {
  if (trend === "up") return <TrendingUp size={14} color={colors.primary} />;
  if (trend === "down") return <TrendingDown size={14} color={colors.textSecondary} />;
  return null;
}
