import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import {
  getFocusBenchmark,
  getFocusColor,
  getFocusScoreTips,
  type FocusScoreData,
} from "../../lib/focusScore";
import {
  buildFocusHeadline,
  deriveFocusTier,
  translateInsightItem,
} from "../../lib/sessionInsightsI18n";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { formatDurationWords } from "../../lib/sessionTime";
import type { SessionDetailInsightsDto } from "../../types/insights";
import type { SessionDto } from "../../types/session";

type Props = {
  session: SessionDto;
  insights: SessionDetailInsightsDto;
  producerName?: string;
};

function focusRing(score: number) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return { size, stroke, r, c, p: Math.max(0.02, Math.min(1, score / 100)) };
}

export function SessionInsightSections({ session, insights, producerName: _producerName }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const ring = useMemo(() => focusRing(insights.focus_score), [insights.focus_score]);
  const ringColor = useMemo(() => getFocusColor(insights.focus_score), [insights.focus_score]);

  const focusInput = useMemo((): FocusScoreData => {
    return {
      duration_minutes: (session.duration_seconds ?? 0) / 60,
      paused_duration_minutes: insights.paused_seconds / 60,
      session_type: String(session.session_type),
      notes_length: (session.notes ?? "").length,
      mood_level: session.mood_level ?? 3,
    };
  }, [session, insights.paused_seconds]);

  const focusTips = useMemo(() => getFocusScoreTips(focusInput, t), [focusInput, t]);
  const benchmark = useMemo(
    () => getFocusBenchmark(insights.focus_score, insights.focus_user_average ?? null, t),
    [insights.focus_score, insights.focus_user_average, t],
  );

  const typeLabel = sessionTypeLabel(String(session.session_type), t);
  void typeLabel;

  const focusSubText = useMemo(() => {
    const tier = insights.focus_tier ?? deriveFocusTier(insights.focus_score);
    return buildFocusHeadline(insights.focus_score, tier, t);
  }, [insights.focus_score, insights.focus_tier, t]);

  const impactLines = useMemo(() => {
    const items = insights.impact_items;
    if (items && items.length > 0) {
      return items.map((it) => translateInsightItem(it, t));
    }
    return insights.impact_lines;
  }, [insights.impact_items, insights.impact_lines, t]);

  const productivityLines = useMemo(() => {
    const items = insights.productivity_items;
    if (items && items.length > 0) {
      return items.map((it) => translateInsightItem(it, t));
    }
    return insights.productivity_insights;
  }, [insights.productivity_items, insights.productivity_insights, t]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.impactCard, styles.impactCardSurface]}>
        <Text style={styles.sectionLabel}>{t("sessionInsights.impact")}</Text>
        {impactLines.map((line, idx) => (
          <Text key={`${idx}-${line}`} style={styles.impactLine}>
            {line}
          </Text>
        ))}
      </View>

      <View style={styles.focusCard}>
        <Text style={styles.sectionLabel}>{t("sessionInsights.focusScore")}</Text>
        <View style={styles.focusRow}>
          <Svg
            width={ring.size}
            height={ring.size}
            style={[styles.ringSvg, { transform: [{ rotate: "-90deg" }] }]}
          >
            <Circle
              cx={ring.size / 2}
              cy={ring.size / 2}
              r={ring.r}
              stroke="#2a2a2a"
              strokeWidth={ring.stroke}
              fill="none"
            />
            <Circle
              cx={ring.size / 2}
              cy={ring.size / 2}
              r={ring.r}
              stroke={ringColor}
              strokeWidth={ring.stroke}
              fill="none"
              strokeDasharray={`${ring.c * ring.p} ${ring.c}`}
              strokeLinecap="round"
            />
          </Svg>
          <View style={styles.focusTextCol}>
            <Text style={styles.focusBig}>{insights.focus_score}%</Text>
            <Text style={styles.focusSub}>{focusSubText}</Text>
            {insights.focus_percentile != null ? (
              <Text style={styles.focusBench}>
                {t("sessionInsights.betterThanPercent", { pct: insights.focus_percentile })}
              </Text>
            ) : null}
            {benchmark ? <Text style={styles.focusBench}>{benchmark}</Text> : null}
            {focusTips.length > 0 ? (
              <View style={styles.tipsBlock}>
                <Text style={styles.tipsTitle}>{t("sessionInsights.tipsTitle")}</Text>
                {focusTips.map((tip) => (
                  <Text key={tip} style={styles.tipLine}>
                    • {tip}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t("sessionInsights.timeBreakdown")}</Text>
        <Text style={styles.rowLine}>
          {t("sessionInsights.active", { duration: formatDurationWords(insights.active_seconds) })}
        </Text>
        <Text style={styles.rowLine}>
          {t("sessionInsights.paused", { duration: formatDurationWords(insights.paused_seconds) })}
        </Text>
        <Text style={styles.rowLine}>
          {t("sessionInsights.effectiveRate", {
            pct: insights.effective_rate_percent.toFixed(0),
          })}
        </Text>
        <View style={styles.timeline}>
          {insights.timeline.map((seg, i) => (
            <View
              key={`${seg.kind}-${i}`}
              style={[
                styles.timelineSeg,
                { flex: Math.max(1, seg.seconds) },
                seg.kind === "paused" ? styles.timelinePaused : styles.timelineActive,
              ]}
            />
          ))}
        </View>
      </View>

      {productivityLines.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t("sessionInsights.productivity")}</Text>
          {productivityLines.map((line, idx) => (
            <Text key={`${idx}-${line}`} style={styles.insightTxt}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {insights.related_sessions.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t("sessionInsights.similarSessions")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.relRow}
          >
            {insights.related_sessions.map((s) => (
              <Pressable
                key={s.id}
                style={styles.relCard}
                onPress={() => router.push(`/session/${s.id}`)}
              >
                <Text style={styles.relType}>{sessionTypeLabel(String(s.session_type), t)}</Text>
                <Text style={styles.relDur}>{formatDurationWords(s.duration_seconds ?? 0)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  impactCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  impactCardSurface: {
    backgroundColor: "rgba(255,61,0,0.08)",
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  impactLine: { color: colors.textPrimary, ...typography.body, marginBottom: 6 },
  focusCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  focusRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  ringSvg: { transform: [{ rotate: "0deg" }] },
  focusTextCol: { flex: 1, gap: 4 },
  focusBig: { fontSize: 36, fontFamily: fontFamily.heading, color: colors.textPrimary },
  focusSub: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  focusBench: { color: colors.textSecondary, ...typography.caption },
  tipsBlock: { marginTop: spacing.sm, gap: 4 },
  tipsTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  tipLine: { color: colors.textSecondary, ...typography.caption },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  rowLine: { color: colors.textPrimary, ...typography.body, marginBottom: 4 },
  timeline: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  timelineSeg: { height: "100%" },
  timelineActive: { backgroundColor: colors.primary },
  timelinePaused: { backgroundColor: "rgba(255,255,255,0.2)" },
  insightTxt: { color: colors.textSecondary, ...typography.caption, marginBottom: 6 },
  relRow: { gap: spacing.sm, paddingVertical: 4 },
  relCard: {
    width: 140,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  relType: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  relDur: { color: colors.textSecondary, ...typography.caption, marginTop: 4 },
});
