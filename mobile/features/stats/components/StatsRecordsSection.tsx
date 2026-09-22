import type { TFunction } from "i18next";
import { StyleSheet, Text, View } from "react-native";

import { RecordGlyph } from "../../../components/icons/ProdifyGlyphs";
import { EmptyState } from "../../../components/states/EmptyState";
import { fontFamily } from "../../../constants/fonts";
import { colors, spacing, typography } from "../../../constants/theme";
import { STATS_RECORDS_PREVIEW } from "../constants";
import type { DecoratedRecord } from "../types";
import { formatRecordContext, formatRecordDate, recordTitle } from "../utils/records";
import { StatsSection } from "./StatsSection";

type Props = {
  t: TFunction;
  records: DecoratedRecord[];
};

function recordMeta(record: DecoratedRecord, t: TFunction): string | null {
  return formatRecordDate(record.occurred_at, t) ?? formatRecordContext(record, t);
}

export function StatsRecordsSection({ t, records }: Props) {
  const preview = records.slice(0, STATS_RECORDS_PREVIEW);
  return (
    <StatsSection title={t("stats.recordsTitle")} testID="stats-section-records">
      {records.length === 0 ? (
        <EmptyState compact title={t("stats.recordsEmptyTitle")} message={t("stats.recordsEmpty")} />
      ) : (
        <View style={styles.wrap}>
          {preview.map((record) => {
            const meta = recordMeta(record, t);
            return (
              <View key={`top-${record.key}${record.occurred_at ?? ""}`} style={styles.row}>
                <RecordGlyph recordKey={record.key} size={16} />
                <View style={styles.copy}>
                  <View style={styles.titleRow}>
                    <Text style={styles.label}>{recordTitle(record.key, record.label, t)}</Text>
                    {record.isFresh ? (
                      <Text style={styles.fresh}>{t("stats.recordFresh")}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.value}>{record.value}</Text>
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
    gap: spacing.sm,
    paddingVertical: spacing.xs,
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
    fontSize: 18,
    lineHeight: 22,
  },
  meta: {
    color: colors.textSecondary,
    ...typography.meta,
  },
});
