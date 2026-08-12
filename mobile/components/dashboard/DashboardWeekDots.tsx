import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import type { TFunction } from "i18next";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../constants/theme";
import type { StreakOverviewDto } from "../../types/streak";
import { styles } from "./DashboardStudioHud.styles";

type WeekDotKind = "none" | "session" | "freeze";

export function DashboardWeekDots({
  overview,
  onOpenHistory,
  t,
}: {
  overview: StreakOverviewDto;
  onOpenHistory: () => void;
  t: TFunction;
}) {
  const kinds = (overview.last_7_day_states ?? []) as WeekDotKind[];
  const labels = overview.last_7_day_labels ?? [];
  if (kinds.length !== 7 || labels.length !== 7) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("streakHero.historyA11y")}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onOpenHistory();
      }}
      style={({ pressed }) => [styles.weekRow, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.weekDots}>
        {labels.map((label, index) => {
          const kind = kinds[index] ?? "none";
          const isToday = index === 6;
          return (
            <View key={`${label}-${index}`} style={styles.dayColumn}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {label.slice(0, 1)}
              </Text>
              <View
                style={[
                  styles.dayDot,
                  kind === "session" && styles.dayDotSession,
                  kind === "freeze" && styles.dayDotFreeze,
                  isToday && styles.dayDotToday,
                ]}
              />
            </View>
          );
        })}
      </View>
      <ChevronRight color={colors.secondary} size={18} />
    </Pressable>
  );
}
