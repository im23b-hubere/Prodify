import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { colors } from "../../constants/theme";

export default function LegalLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: "700", fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="privacy" options={{ title: t("legal.privacy.screenTitle") }} />
      <Stack.Screen name="terms" options={{ title: t("legal.terms.screenTitle") }} />
    </Stack>
  );
}
