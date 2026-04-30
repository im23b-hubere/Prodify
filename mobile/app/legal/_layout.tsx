import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { colors } from "../../constants/theme";

export default function LegalLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        /* In-screen `LegalDocumentScreen` provides title, subtitle, and back — avoid duplicate native headers. */
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="privacy" options={{ title: t("legal.privacy.screenTitle") }} />
      <Stack.Screen name="terms" options={{ title: t("legal.terms.screenTitle") }} />
    </Stack>
  );
}
