import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export type ShareTemplateId = "minimal" | "bold" | "gradient";

export const STORY_CAPTURE_WIDTH = 360;
export const STORY_CAPTURE_HEIGHT = 640;

type Props = {
  template: ShareTemplateId;
  /** Human-readable session type label (not slug). */
  sessionType: string;
  durationLabel: string;
  focusScore: number;
  producerName?: string;
};

function ShareBrandFooter({ subtle = false }: { subtle?: boolean }) {
  return (
    <Text style={[styles.shareBrandFooter, subtle && styles.shareBrandFooterSubtle]}>Prodify</Text>
  );
}

export function SessionShareStoryCard({
  template,
  sessionType,
  durationLabel,
  focusScore,
  producerName,
}: Props) {
  const who = producerName?.trim() || "Producer";

  if (template === "minimal") {
    return (
      <View style={[styles.frame, styles.minimalBg]}>
        <Text style={styles.brandSmall}>PRODIFY</Text>
        <Text style={styles.minimalType}>{sessionType}</Text>
        <Text style={styles.minimalDur}>{durationLabel}</Text>
        <Text style={styles.minimalFocus}>Focus {focusScore}%</Text>
        <View style={styles.minimalSpacer} />
        <View style={styles.minimalFooter}>
          <Text style={styles.minimalWho}>{who}</Text>
          <ShareBrandFooter />
        </View>
      </View>
    );
  }

  if (template === "bold") {
    return (
      <View style={styles.frame}>
        <LinearGradient colors={["#1a0a06", "#0a0a0a"]} style={StyleSheet.absoluteFill} />
        <View style={styles.boldStripe}>
          <Text style={styles.boldStripeTxt}>PRODIFY</Text>
        </View>
        <View style={styles.boldBody}>
          <Text style={styles.boldType}>{sessionType.toUpperCase()}</Text>
          <Text style={styles.boldDur}>{durationLabel}</Text>
          <Text style={styles.boldFocus}>FOCUS {focusScore}%</Text>
        </View>
        <View style={styles.boldFooter}>
          <ShareBrandFooter subtle />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <LinearGradient
        colors={["#2d0a4a", "#6b1a5c", colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.gradGlass}>
        <Text style={styles.gradBrand}>Prodify</Text>
        <Text style={styles.gradType}>{sessionType}</Text>
        <Text style={styles.gradDur}>{durationLabel}</Text>
        <View style={styles.gradPill}>
          <Text style={styles.gradPillTxt}>{focusScore}% focus</Text>
        </View>
        <Text style={styles.gradWho}>{who}</Text>
        <ShareBrandFooter />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: STORY_CAPTURE_WIDTH,
    height: STORY_CAPTURE_HEIGHT,
    borderRadius: radii.lg,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  brandSmall: {
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 4,
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
  },
  minimalBg: {
    backgroundColor: "#0a0a0a",
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  minimalType: {
    marginTop: spacing.xl,
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 36,
    lineHeight: 40,
  },
  minimalDur: {
    marginTop: spacing.md,
    color: colors.primary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
  },
  minimalFocus: {
    marginTop: spacing.sm,
    color: "rgba(255,255,255,0.7)",
    ...typography.subheadline,
    fontFamily: fontFamily.bodyMedium,
  },
  minimalSpacer: { flex: 1 },
  minimalFooter: { gap: 6 },
  minimalWho: { color: "rgba(255,255,255,0.55)", ...typography.caption },
  shareBrandFooter: {
    color: colors.primary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  shareBrandFooterSubtle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 22,
    lineHeight: 26,
  },
  boldStripe: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  boldStripeTxt: {
    color: "#0a0a0a",
    fontFamily: fontFamily.heading,
    letterSpacing: 6,
    fontSize: 12,
  },
  boldBody: { flex: 1, padding: spacing.lg, justifyContent: "center", gap: spacing.sm },
  boldType: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 32,
    lineHeight: 36,
  },
  boldDur: { color: colors.primary, fontFamily: fontFamily.heading, fontSize: 26 },
  boldFocus: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: fontFamily.bodyBold,
    ...typography.subheadline,
  },
  boldFooter: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  gradGlass: {
    flex: 1,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    gap: spacing.sm,
  },
  gradBrand: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: fontFamily.heading,
    fontSize: 22,
    letterSpacing: 1,
  },
  gradType: { color: "#fff", fontFamily: fontFamily.heading, fontSize: 34, lineHeight: 38 },
  gradDur: { color: "rgba(255,255,255,0.95)", fontFamily: fontFamily.heading, fontSize: 26 },
  gradPill: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.round,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  gradPillTxt: { color: "#fff", fontFamily: fontFamily.bodyBold, ...typography.caption },
  gradWho: { marginTop: spacing.lg, color: "rgba(255,255,255,0.65)", ...typography.caption },
});
