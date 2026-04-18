import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  onQuickStart: () => void;
};

/** Large invite to start when no session is running (active UI stays on the dashboard for gestures). */
export const DashboardSessionStarter = memo(function DashboardSessionStarter({ onQuickStart }: Props) {
  const router = useRouter();
  return (
    <View style={styles.starterContainer}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          onQuickStart();
        }}
        style={({ pressed }) => [pressed && { opacity: 0.92 }]}
      >
        <LinearGradient colors={["#ff6a3d", colors.primary]} style={styles.quickStart}>
          <Text style={styles.quickEmoji}>▶</Text>
          <Text style={styles.quickTitle}>START SESSION</Text>
          <Text style={styles.quickSub}>Quick setup — type, mood & notes</Text>
        </LinearGradient>
      </Pressable>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          router.push("/session/setup");
        }}
        style={({ pressed }) => [styles.customBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.customTxt}>Customize session</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  starterContainer: { gap: spacing.md, marginTop: spacing.md },
  quickStart: {
    borderRadius: radii.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  quickEmoji: { fontSize: 40, color: "#fff" },
  quickTitle: {
    color: "#fff",
    fontFamily: fontFamily.heading,
    fontSize: 22,
    letterSpacing: 1,
  },
  quickSub: { color: "rgba(255,255,255,0.85)", ...typography.caption, textAlign: "center" },
  customBtn: { alignItems: "center", paddingVertical: spacing.sm },
  customTxt: { color: colors.secondary, fontFamily: fontFamily.bodyBold, ...typography.body },
});
