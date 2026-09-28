import { useTranslation } from "react-i18next";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { fontFamily } from "../../../constants/fonts";
import { colors, spacing } from "../../../constants/theme";
import type { DuelClashPayload, DuelClashSide } from "../duelClashStore";
import { useDuelClashAnimation } from "../hooks/useDuelClashAnimation";

const PHOTO_SIZE = 132;

type Props = {
  clash: DuelClashPayload;
  onFinished: () => void;
};

export function DuelClashOverlay({ clash, onFinished }: Props) {
  const { t } = useTranslation();
  const motion = useDuelClashAnimation(onFinished);
  return (
    <Modal transparent statusBarTranslucent animationType="none" visible onRequestClose={motion.exit}>
      <Animated.View style={[styles.root, motion.backdropStyle]}>
        <Pressable
          testID="duel-clash-overlay"
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityViewIsModal
          accessibilityLabel={t("friendsScreen.duelClashA11y", {
            top: clash.opponent.name,
            bottom: clash.you.name,
          })}
          onPress={motion.exit}
        >
          <Animated.View style={[styles.panel, motion.panelStyle]}>
            <Animated.View style={[styles.line, motion.lineStyle]} />
          </Animated.View>

          <Animated.View style={[styles.side, styles.sideTop, motion.opponentStyle]}>
            <ClashPhoto side={clash.opponent} />
            <Text style={[styles.name, styles.nameRight]} numberOfLines={1}>
              {clash.opponent.name}
            </Text>
          </Animated.View>

          <View style={styles.vsAnchor} pointerEvents="none">
            <Animated.View style={[styles.vsDisc, motion.vsStyle]}>
              <Text style={styles.vsText}>VS</Text>
            </Animated.View>
          </View>

          <Animated.View style={[styles.side, styles.sideBottom, motion.youStyle]}>
            <ClashPhoto side={clash.you} highlighted />
            <Text style={styles.name} numberOfLines={1}>
              {clash.you.name}
            </Text>
          </Animated.View>

          <Animated.View style={[styles.footer, motion.titleStyle]}>
            <Text style={styles.kicker}>{t("friendsScreen.duelClashKicker")}</Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

function ClashPhoto({ side, highlighted }: { side: DuelClashSide; highlighted?: boolean }) {
  const ring = highlighted ? styles.ringAccent : styles.ringNeutral;
  if (side.photoUri) {
    return <Image source={{ uri: side.photoUri }} style={[styles.photo, ring]} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[styles.photo, styles.photoFallback, ring]}>
      <Text style={styles.initials}>{side.name.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: "hidden" },
  panel: {
    position: "absolute",
    left: "-30%",
    right: "-30%",
    top: "-20%",
    height: "62%",
    backgroundColor: colors.surface,
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  side: { position: "absolute", left: spacing.lg, right: spacing.lg, gap: spacing.sm },
  sideTop: { top: "12%", alignItems: "flex-end" },
  sideBottom: { top: "52%", alignItems: "flex-start" },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2 },
  photoFallback: { backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  ringAccent: { borderWidth: 3, borderColor: colors.primary },
  ringNeutral: { borderWidth: 2, borderColor: "rgba(255,255,255,0.16)" },
  initials: { color: colors.textPrimary, fontFamily: fontFamily.heading, fontSize: 44 },
  name: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    maxWidth: "80%",
  },
  nameRight: { textAlign: "right" },
  vsAnchor: { position: "absolute", left: 0, right: 0, top: "42%", marginTop: -38, alignItems: "center" },
  vsDisc: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: { color: colors.primary, fontFamily: fontFamily.heading, fontSize: 26, letterSpacing: -0.5 },
  footer: { position: "absolute", left: 0, right: 0, bottom: "9%", alignItems: "center" },
  kicker: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
  },
});
