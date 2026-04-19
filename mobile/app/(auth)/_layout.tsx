import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function AuthLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#fafafa",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#0a0a0a" },
      }}
    >
      <Stack.Screen name="login" options={{ title: t("auth.stack.login") }} />
      <Stack.Screen name="register" options={{ title: t("auth.stack.register") }} />
    </Stack>
  );
}
