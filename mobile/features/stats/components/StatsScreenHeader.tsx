import { Pressable, Text, View } from "react-native";

import { ScreenHeader } from "../../../components/ui/ScreenHeader";
import type { StatsScreenController } from "../hooks/useStatsScreenController";
import { styles } from "../statsScreen.styles";

export function StatsScreenHeader({ controller }: { controller: StatsScreenController }) {
  const { t, filters, filterIdx, selectFilter } = controller;
  return (
    <View style={styles.headerRow}>
      <ScreenHeader title={t("stats.title")} />
      <View style={styles.filterRow}>
        {filters.map((item, index) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              styles.filterChip,
              filterIdx === index && styles.filterChipActive,
              pressed && styles.filterChipPressed,
            ]}
            onPress={() => selectFilter(index)}
          >
            <Text style={[styles.filterLabel, filterIdx === index && styles.filterLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.filterHint}>{t("stats.filterScopeHint")}</Text>
    </View>
  );
}
