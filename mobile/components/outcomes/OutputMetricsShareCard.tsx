import { LinearGradient } from "expo-linear-gradient";
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

export function OutputMetricsShareCard({ metrics, template }: Props) {
  const { t } = useTranslation();
  const trendLabel =
    metrics.productivity_trend === "up"
      ? t("stats.shareProofTrendUp")
      : metrics.productivity_trend === "down"
        ? t("stats.shareProofTrendDown")
        : t("stats.shareProofTrendStable");
  const outputSign = metrics.output_increase >= 0 ? "+" : "";
  const consistencySign = metrics.consistency_improvement >= 0 ? "+" : "";

  if (template === "minimal") {
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
            outputSign,
            outputPct: Math.round(metrics.output_increase),
            consistencySign,
            consistencyPct: Math.round(metrics.consistency_improvement),
          })}
        </Text>
        <Text style={styles.footer}>
          {t("stats.shareProofCardMinimalFooter", {
            days: metrics.days_using,
            completed: metrics.completed_tracks,
          })}
        </Text>
      </View>
    );
  }

  if (template === "bold") {
    return (
      <View style={styles.frame}>
        <LinearGradient colors={["#1a0a06", "#0a0a0a"]} style={StyleSheet.absoluteFill} />
        <View style={styles.boldStripe}>
          <Text style={styles.boldStripeTxt}>{t("stats.shareProofCardBoldStripe")}</Text>
        </View>
        <View style={[styles.glassCard, styles.boldCard]}>
          <Text style={styles.title}>{t("stats.shareProofCardBoldTitle")}</Text>
          <Text style={styles.boldHuge}>{metrics.tracks_finished_30d}</Text>
          <Text style={styles.metricLine}>
            {t("stats.shareProofCardBoldLine", {
              outputSign,
              outputPct: Math.round(metrics.output_increase),
              trend: trendLabel,
            })}
          </Text>
          <Text style={styles.footer}>
            {t("stats.shareProofCardBoldFooter", {
              days: metrics.days_using,
              completed: metrics.completed_tracks,
            })}
          </Text>
        </View>
      </View>
    );
  }

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
              sign: outputSign,
              pct: Math.round(metrics.output_increase),
            })}
          </Text>
          <Text style={styles.metricLine}>
            {t("stats.shareProofCardGradientConsistency", {
              sign: consistencySign,
              pct: Math.round(metrics.consistency_improvement),
            })}
          </Text>
          <Text style={styles.metricLine}>
            {t("stats.shareProofCardGradientAvgCompletion", {
              days: metrics.avg_completion_time_days,
            })}
          </Text>
          <Text style={styles.metricLine}>{trendLabel}</Text>
        </View>

        <Text style={styles.footer}>
          {t("stats.shareProofCardGradientFooter", {
            days: metrics.days_using,
            completed: metrics.completed_tracks,
          })}
        </Text>
      </View>
    </View>
  );
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
});
