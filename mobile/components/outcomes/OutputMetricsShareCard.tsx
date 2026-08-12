import { LinearGradient } from "expo-linear-gradient";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { OutputMetricsDto } from "../../types/outcomes";

export const OUTPUT_SHARE_WIDTH = 360;
export const OUTPUT_SHARE_HEIGHT = 640;
export type OutputShareTemplateId = "minimal" | "bold" | "gradient";

type Props = {
  metrics: OutputMetricsDto;
  template: OutputShareTemplateId;
};

type TemplateProps = { metrics: OutputMetricsDto; t: TFunction; trendLabel: string };

function signed(value: number): { sign: string; rounded: number } {
  return { sign: value >= 0 ? "+" : "", rounded: Math.round(value) };
}

function trendLabel(metrics: OutputMetricsDto, t: TFunction): string {
  const keys = {
    up: "stats.shareProofTrendUp",
    down: "stats.shareProofTrendDown",
    stable: "stats.shareProofTrendStable",
  } as const;
  return t(keys[metrics.productivity_trend]);
}

function MinimalTemplate({ metrics, t }: TemplateProps) {
  const output = signed(metrics.output_increase);
  const consistency = signed(metrics.consistency_improvement);
  return (
    <View style={[styles.frame, styles.minimalBg]}>
      <Text style={styles.brand}>PRODIFY</Text>
      <Text style={styles.title}>{t("stats.shareProofCardMinimalTitle")}</Text>
      <Text style={styles.minimalLine}>
        {t("stats.shareProofCardGradientAvgCompletion", {
          days: metrics.avg_completion_time_days,
        })}
      </Text>
      <Text style={styles.minimalLine}>
        {t("stats.shareProofCardMinimalLine2", {
          outputSign: output.sign,
          outputPct: output.rounded,
          consistencySign: consistency.sign,
          consistencyPct: consistency.rounded,
        })}
      </Text>
      <Text style={styles.footer}>
        {t("stats.shareProofCardMinimalFooter", {
          days: metrics.days_using,
          completed: metrics.completed_tracks,
        })}
      </Text>
      <Text style={styles.brandFooter}>Prodify</Text>
    </View>
  );
}

function BoldTemplate({ metrics, t, trendLabel: trend }: TemplateProps) {
  const output = signed(metrics.output_increase);
  return (
    <View style={styles.frame}>
      <LinearGradient colors={["#1a0a06", "#0a0a0a"]} style={StyleSheet.absoluteFill} />
      <View style={styles.boldStripe}>
        <Text style={styles.boldStripeTxt}>PRODIFY</Text>
      </View>
      <View style={[styles.glassCard, styles.boldCard]}>
        <Text style={styles.title}>{t("stats.shareProofCardBoldTitle")}</Text>
        <Text style={styles.boldHuge}>{metrics.tracks_finished_30d}</Text>
        <Text style={styles.metricLine}>
          {t("stats.shareProofCardBoldLine", {
            outputSign: output.sign,
            outputPct: output.rounded,
            trend,
          })}
        </Text>
        <Text style={styles.footer}>
          {t("stats.shareProofCardBoldFooter", {
            days: metrics.days_using,
            completed: metrics.completed_tracks,
          })}
        </Text>
        <Text style={styles.brandFooter}>Prodify</Text>
      </View>
    </View>
  );
}

function GradientTemplate({ metrics, t, trendLabel: trend }: TemplateProps) {
  const output = signed(metrics.output_increase);
  const consistency = signed(metrics.consistency_improvement);
  return (
    <View style={styles.frame}>
      <LinearGradient colors={["#12070a", "#2a0f16", "#3d1600"]} style={StyleSheet.absoluteFill} />
      <View style={styles.glassCard}>
        <Text style={styles.brand}>PRODIFY</Text>
        <Text style={styles.title}>{t("stats.shareProofCardGradientTitle")}</Text>
        <Text style={styles.big}>{metrics.tracks_finished_30d}</Text>

        <View style={styles.metricBlock}>
          <Text style={styles.metricLine}>
            {t("stats.shareProofCardGradientOutput", {
              sign: output.sign,
              pct: output.rounded,
            })}
          </Text>
          <Text style={styles.metricLine}>
            {t("stats.shareProofCardGradientConsistency", {
              sign: consistency.sign,
              pct: consistency.rounded,
            })}
          </Text>
          <Text style={styles.metricLine}>
            {t("stats.shareProofCardGradientAvgCompletion", {
              days: metrics.avg_completion_time_days,
            })}
          </Text>
          <Text style={styles.metricLine}>{trend}</Text>
        </View>

        <Text style={styles.footer}>
          {t("stats.shareProofCardGradientFooter", {
            days: metrics.days_using,
            completed: metrics.completed_tracks,
          })}
        </Text>
        <Text style={styles.brandFooter}>Prodify</Text>
      </View>
    </View>
  );
}

export function OutputMetricsShareCard({ metrics, template }: Props) {
  const { t } = useTranslation();
  const templateProps = { metrics, t, trendLabel: trendLabel(metrics, t) };
  if (template === "minimal") return <MinimalTemplate {...templateProps} />;
  if (template === "bold") return <BoldTemplate {...templateProps} />;
  return <GradientTemplate {...templateProps} />;
}

const styles = StyleSheet.create({
  frame: {
    width: OUTPUT_SHARE_WIDTH,
    height: OUTPUT_SHARE_HEIGHT,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  glassCard: {
    flex: 1,
    margin: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(0,0,0,0.32)",
    padding: spacing.lg,
    gap: spacing.md,
  },
  minimalBg: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "#0a0a0a",
    gap: spacing.md,
  },
  minimalLine: {
    color: colors.textPrimary,
    ...typography.body,
    fontFamily: fontFamily.bodyMedium,
  },
  boldStripe: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  boldStripeTxt: {
    color: "#0a0a0a",
    fontFamily: fontFamily.heading,
    letterSpacing: 3,
    fontSize: 12,
  },
  boldCard: {
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "transparent",
  },
  boldHuge: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 48,
    lineHeight: 52,
  },
  brand: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: fontFamily.bodyBold,
    letterSpacing: 2,
    fontSize: 12,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 30,
    lineHeight: 34,
  },
  big: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 34,
    lineHeight: 38,
  },
  metricBlock: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.2)",
    gap: 6,
  },
  metricLine: {
    color: colors.textPrimary,
    ...typography.body,
    fontFamily: fontFamily.bodyMedium,
  },
  footer: {
    marginTop: "auto",
    color: "rgba(255,255,255,0.7)",
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  brandFooter: {
    color: colors.primary,
    fontFamily: fontFamily.heading,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
});
