import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  label: string;
  hint?: string;
  icon: LucideIcon;
  selected: boolean;
  index: number;
  onPress: () => void;
};

export function QuizOptionCard({ label, hint, icon: Icon, selected, index, onPress }: Props) {
  return (
    <Animated.View entering={FadeInUp.delay(index * 45).duration(300).springify()}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          styles.card,
          selected && styles.cardOn,
          pressed && styles.cardPressed,
        ]}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onPress();
        }}
      >
        <View style={[styles.iconWrap, selected && styles.iconWrapOn]}>
          <Icon color={selected ? colors.primary : colors.textSecondary} size={20} strokeWidth={2.2} />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
          {hint ? <Text style={[styles.hint, selected && styles.hintOn]}>{hint}</Text> : null}
        </View>
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardOn: {
    borderColor: "rgba(255,61,0,0.55)",
    backgroundColor: "rgba(255,61,0,0.08)",
  },
  cardPressed: { opacity: 0.92 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrapOn: {
    borderColor: "rgba(255,61,0,0.35)",
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  textCol: { flex: 1, gap: 2 },
  label: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
  },
  labelOn: { color: colors.textPrimary },
  hint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  hintOn: { color: "rgba(255,255,255,0.72)" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.round,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
});
