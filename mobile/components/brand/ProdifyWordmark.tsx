import { useTranslation } from "react-i18next";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors } from "../../constants/theme";

type Props = {
  size?: "splash" | "hero";
  style?: StyleProp<TextStyle>;
};

export function ProdifyWordmark({ size = "hero", style }: Props) {
  const { t } = useTranslation();

  return (
    <Text
      accessibilityRole="header"
      style={[size === "splash" ? styles.splash : styles.hero, style]}
    >
      {t("brand")}
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: {
    color: colors.primary,
    fontFamily: fontFamily.heading,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.5,
  },
  splash: {
    color: colors.primary,
    fontFamily: fontFamily.heading,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2,
  },
});
