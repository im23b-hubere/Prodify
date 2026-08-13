import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import type { StreakRunDto } from "../../../types/streak";
import { styles } from "../streakHistory.styles";
import { formatStreakRange, isActiveStreakRun } from "../streakHistoryPresentation";

type Props = {
  run: StreakRunDto;
  index: number;
  currentStreak: number | null;
};

export function StreakRunCard({ run, index, currentStreak }: Props) {
  const { t } = useTranslation();
  const isCurrent = isActiveStreakRun(run, index, currentStreak);
  const accessibilityLabel = t(
    isCurrent ? "streakHistory.runA11yCurrent" : "streakHistory.runA11y",
    { count: run.length_days, start: run.start_date, end: run.end_date },
  );
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(360)}>
      <View
        style={[styles.card, isCurrent && styles.cardCurrent]}
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.days}>
            {run.length_days} {t("streakHistory.dayUnit", { count: run.length_days })}
          </Text>
          {isCurrent ? (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>{t("streakHistory.currentBadge")}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.range}>{formatStreakRange(run.start_date, run.end_date)}</Text>
      </View>
    </Animated.View>
  );
}
