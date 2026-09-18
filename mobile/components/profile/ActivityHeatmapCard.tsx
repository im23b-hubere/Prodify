import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";

import { colors, typography } from "../../constants/theme";
import { StatsSection } from "../../features/stats/components/StatsSection";
import { ActivityHeatmapGrid } from "../charts/ActivityHeatmapGrid";

export type HeatmapDay = { date: string; seconds: number; intensity: number };

type Props = { days: HeatmapDay[] };

export const ActivityHeatmapCard = memo(function ActivityHeatmapCard({ days }: Props) {
  const { t } = useTranslation();
  return (
    <StatsSection title={t("stats.heatmapTitle")} subtitle={t("stats.heatmapCaptionShort")}>
      {days.length === 0 ? (
        <Text style={styles.empty}>{t("profileHeatmap.empty")}</Text>
      ) : (
        <ActivityHeatmapGrid days={days} />
      )}
    </StatsSection>
  );
});

const styles = StyleSheet.create({
  empty: { color: colors.textSecondary, ...typography.caption },
});
