import type { TFunction } from "i18next";
import { StyleSheet, Text, View } from "react-native";

import { RecordGlyph } from "../../../components/icons/ProdifyGlyphs";
import { EmptyState } from "../../../components/states/EmptyState";
import { fontFamily } from "../../../constants/fonts";
import { colors, spacing, typography } from "../../../constants/theme";
import type { DecoratedRecord } from "../types";
import { formatRecordContext, formatRecordDate, recordTitle } from "../utils/records";
import { StatsSection } from "./StatsSection";

type Props = {
  t: TFunction;
  records: DecoratedRecord[];
};

export function StatsRecordsSection({ t, records }: Props) {
  return (
    <StatsSection
      title={t("stats.recordsTitle")}
      subtitle={records.length > 0 ? t("stats.recordsSubtitle") : undefined}
      testID="stats-section-records"
    >
      {records.length === 0 ? (
        <EmptyState compact title={t("stats.recordsEmptyTitle")} message={t("stats.recordsEmpty")} />
      ) : (
        <View style={styles.wrap}>
          {records.slice(0, 3).map((record) => {
            const meta = formatRecordDate(record.occurred_at, t);
            const displayContext = formatRecordContext(record, t);
            return (
              <View key={`top-${record.key}${record.occurred_at ?? ""}`} style={styles.row}>
                <View style={styles.accent} />
                <View style={styles.copy}>
                  <View style={styles.titleRow}>
                    <RecordGlyph recordKey={record.key} size={16} />
                    <Text style={styles.label}>{recordTitle(record.key, record.label, t)}</Text>
                    {record.isFresh ? <Text style={styles.fresh}>{t("stats.recordFresh")}</Text> : null}
                  </View>
                  <Text style={styles.value}>{record.value}</Text>
                  {displayContext ? <Text style={styles.meta}>{displayContext}</Text> : null}
                  {meta ? <Text style={styles.meta}>{meta}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </StatsSection>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accent: {
    width: 3,
    height: 28,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    ...typography.meta,
    fontFamily: fontFamily.bodyMedium,
    flexShrink: 1,
  },
  fresh: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 22,
    lineHeight: 28,
  },
  meta: {
    color: colors.textSecondary,
    ...typography.meta,
  },
});
