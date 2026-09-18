import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, typography } from "../../constants/theme";

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** The app-wide top-left back control ("‹ Back"). Use it instead of per-screen back buttons. */
export function BackButton({ onPress, style }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("common.goBack")}
      hitSlop={12}
      onPress={onPress}
      style={style}
    >
      <Text style={styles.label}>{t("common.backArrow")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.body },
});
