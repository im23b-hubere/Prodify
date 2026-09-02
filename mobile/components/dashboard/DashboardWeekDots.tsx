import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import type { TFunction } from "i18next";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../constants/theme";
import type { StreakOverviewDto } from "../../types/streak";
import { styles } from "./DashboardStudioHud.styles";

type WeekDotKind = "none" | "session" | "freeze";

const BAR_HEIGHT = {
  none: 6,
  freeze: 12,
  session: 22,
} as const;

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
                {label.slice(0, 2)}
              </Text>
              <View style={[styles.weekBarTrack, isToday && styles.weekBarTrackToday]}>
                <View
                  style={[
                    styles.weekBarFill,
                    { height: BAR_HEIGHT[kind] },
                    kind === "session" && styles.weekBarSession,
                    kind === "freeze" && styles.weekBarFreeze,
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <ChevronRight color={colors.textSecondary} size={16} />
    </Pressable>
  );
}
