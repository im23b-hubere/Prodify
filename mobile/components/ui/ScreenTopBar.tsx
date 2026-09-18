import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography } from "../../constants/theme";
import { BackButton } from "./BackButton";

type Props = {
  title: string;
  subtitle?: string | null;
  onBack: () => void;
  style?: StyleProp<ViewStyle>;
};

// Keeps the title optically centered: the spacer on the right mirrors the back button's width.
const SIDE_WIDTH = 56;

/** Header for pushed screens: "‹ Back" on the left, the title centered next to it. */
export function ScreenTopBar({ title, subtitle, onBack, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <BackButton onPress={onBack} style={styles.side} />
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {title}
        </Text>
        <View style={styles.side} />
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: "row", alignItems: "center" },
  side: { minWidth: SIDE_WIDTH },
  title: {
    flex: 1,
    marginHorizontal: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
    textAlign: "center",
  },
});
