import type { TFunction } from "i18next";
import { StyleSheet, Text, View } from "react-native";

import { RecordGlyph } from "../../../components/icons/ProdifyGlyphs";
import { EmptyState } from "../../../components/states/EmptyState";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import type { DecoratedRecord } from "../types";
import {
  formatRecordContext,
  formatRecordDate,
  recordTitle,
} from "../utils/records";
import { StatsSection } from "./StatsSection";

type Props = {
  t: TFunction;
  records: DecoratedRecord[];
  onStartSession: () => void;
};

export function StatsRecordsSection({ t, records, onStartSession }: Props) {
  return (
    <StatsSection
      title={t("stats.recordsTitle")}
      subtitle={records.length > 0 ? t("stats.recordsSubtitle") : undefined}
      testID="stats-section-records"
    >
      {records.length === 0 ? (
        <EmptyState
          compact
          title={t("stats.recordsEmptyTitle")}
          message={t("stats.recordsEmpty")}
          actionLabel={t("common.startSession")}
          onAction={onStartSession}
        />
      ) : (
        <View style={styles.wrap}>
          {records.slice(0, 3).map((record, idx) => {
            const meta = formatRecordDate(record.occurred_at, t);
            const displayContext = formatRecordContext(record, t);
            return (
              <View
                key={`top-${record.key}${record.occurred_at ?? ""}`}
                style={[styles.card, idx === 0 && styles.cardFeatured]}
              >
                <View style={styles.titleRow}>
                  <View style={styles.labelWrap}>
                    <RecordGlyph recordKey={record.key} size={16} />
                    <Text style={styles.label}>{recordTitle(record.key, record.label, t)}</Text>
                  </View>
                  <View style={styles.badgesRow}>
                    {record.isFresh ? (
                      <View style={[styles.badge, styles.badgeFresh]}>
                        <Text style={[styles.badgeText, styles.badgeTextFresh]}>
                          {t("stats.recordFresh")}
                        </Text>
                      </View>
                    ) : null}
                    {idx === 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{t("stats.recordBest")}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.value, idx === 0 && styles.valueFeatured]}>{record.value}</Text>
                {displayContext ? <Text style={styles.ctx}>{displayContext}</Text> : null}
                {meta ? <Text style={styles.meta}>{meta}</Text> : null}
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
    gap: spacing.sm,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: 6,
  },
  cardFeatured: {
    borderColor: "rgba(162,89,255,0.45)",
    backgroundColor: "rgba(162,89,255,0.08)",
    shadowColor: colors.secondary,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  labelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  badge: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(255,61,0,0.2)",
  },
  badgeFresh: {
    backgroundColor: "rgba(162,89,255,0.2)",
  },
  badgesRow: {
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
  badgeText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
  },
  badgeTextFresh: {
    color: colors.secondary,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 24,
    lineHeight: 30,
  },
  valueFeatured: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  ctx: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  meta: {
    marginTop: 2,
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
  },
});
