import type { TFunction } from "i18next";
import { Flame } from "lucide-react-native";
import { memo } from "react";
import { Text, View } from "react-native";

import { PrimaryButton } from "../../../../components/ui/PrimaryButton";
import { colors } from "../../../../constants/theme";
import { friendsRankingStyles as styles } from "../../styles/friendsRanking.styles";
import type { RankingChase, YourStanding } from "../friendsRanking";

type Props = {
  t: TFunction;
  standing: YourStanding;
  period: "week" | "all";
  onStartSession: () => void;
};

/** The one thing the overview asks of the user: your place, who is next to you, go produce. */
export const WeekHeroCard = memo(function WeekHeroCard({
  t,
  standing,
  period,
  onStartSession,
}: Props) {
  const periodLabel = t(
    period === "week" ? "friendsOverview.heroWeek" : "friendsOverview.heroAllTime",
  );
  const sessionsLabel = t("friendsOverview.sessionCount", { count: standing.sessions });
  const positionOf = t("friendsOverview.positionOf", { total: standing.total });
  const chase = chaseLine(standing.chase, t);
  return (
    <View style={styles.card} testID="friends-week-hero">
      <View
        style={styles.hero}
        accessible
        accessibilityLabel={t("friendsOverview.heroA11y", {
          period: periodLabel,
          position: standing.position,
          total: standing.total,
          sessions: sessionsLabel,
          chase,
        })}
      >
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel} numberOfLines={1}>
            {periodLabel} · {sessionsLabel}
          </Text>
          {standing.streakDays > 0 ? (
            <View style={styles.streakChip}>
              <Flame size={12} color={colors.primary} />
              <Text style={styles.streakChipText}>
                {t("friendsOverview.streakDays", { count: standing.streakDays })}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.positionRow}>
          <Text style={styles.position}>#{standing.position}</Text>
          <Text style={styles.positionOf}>{positionOf}</Text>
        </View>
        <Text style={[styles.chase, standing.chase.kind === "leading" && styles.chaseAccent]}>
          {chase}
        </Text>
      </View>
      <View style={styles.heroAction}>
        <PrimaryButton
          label={t("friendsOverview.startSession")}
          onPress={onStartSession}
          testID="friends-week-hero-start"
        />
      </View>
    </View>
  );
});

function chaseLine(chase: RankingChase, t: TFunction) {
  switch (chase.kind) {
    case "fresh":
      return t("friendsOverview.chaseFresh");
    case "leading":
      return t("friendsOverview.chaseLeading", { count: chase.gap });
    case "tied":
      return t("friendsOverview.chaseTied", { name: chase.name });
    case "behind":
      return t("friendsOverview.chaseBehind", { count: chase.gap, name: chase.name });
  }
}
