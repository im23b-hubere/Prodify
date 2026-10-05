import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import { EmptyState } from "../../../components/states/EmptyState";
import { fontFamily } from "../../../constants/fonts";
import type { SessionType } from "../../../constants/sessionTypes";
import { colors, motion, radii, spacing, typography } from "../../../constants/theme";
import type { WoranRow } from "../utils/woran";
import { StatsSection } from "./StatsSection";

type Props = {
  t: TFunction;
  rows: WoranRow[];
  onOpenBranch: (branch: string) => void;
};

export function StatsWoranSection({ t, rows, onOpenBranch }: Props) {
  return (
    <StatsSection
      title={t("stats.woranTitle")}
      subtitle={t("stats.woranSubtitle")}
      testID="stats-woran"
    >
      {rows.length === 0 ? (
        <EmptyState compact title={t("stats.woranEmptyTitle")} message={t("stats.woranEmpty")} />
      ) : (
        <View style={styles.list}>
          {rows.map((row) => (
            <WoranBranchRow key={row.branch} row={row} onOpenBranch={onOpenBranch} />
          ))}
        </View>
      )}
    </StatsSection>
  );
}

function WoranBranchRow({
  row,
  onOpenBranch,
}: {
  row: WoranRow;
  onOpenBranch: (branch: string) => void;
}) {
  const accent = sessionTypeAccent(row.branch as SessionType);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.label}
      accessibilityHint={row.hoursLabel}
      testID={`stats-woran-${row.branch}`}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onOpenBranch(row.branch);
      }}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <View style={styles.copy}>
        <View style={styles.top}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <Text style={styles.name} numberOfLines={1}>
            {row.label}
          </Text>
          <Text style={styles.hours}>{row.hoursLabel}</Text>
          <ChevronRight color={colors.textSecondary} size={16} />
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { backgroundColor: accent, width: `${Math.round(row.share * 100)}%` }]} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    borderRadius: radii.sm,
    borderCurve: "continuous",
    paddingVertical: spacing.xs,
  },
  rowPressed: {
    opacity: motion.pressOpacity,
    transform: [{ scale: motion.pressScale }],
  },
  copy: {
    gap: 6,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  hours: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  track: {
    height: 4,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: radii.round,
  },
});
