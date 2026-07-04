import "../lib/i18n";
/* eslint-disable import/no-duplicates -- gesture-handler needs a side-effect import before named imports */
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
/* eslint-enable import/no-duplicates */
import "react-native-reanimated";

import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts as useDmSansFonts,
} from "@expo-google-fonts/dm-sans";
import { Syne_700Bold, useFonts as useSyneFonts } from "@expo-google-fonts/syne";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ProdifyWordmark } from "../components/brand/ProdifyWordmark";
import { NotificationNavBridge } from "../components/NotificationNavBridge";
import { DeepLinkGuard } from "../components/DeepLinkGuard";
import { OfflineBanner } from "../components/OfflineBanner";
import { CrashBoundary } from "../components/ui/CrashBoundary";
import { AuthProvider } from "../context/AuthContext";
import { colors, spacing } from "../constants/theme";
import { initSentry } from "../lib/sentry";
import { configureNotificationHandler } from "../lib/streakNotifications";

initSentry();
configureNotificationHandler();

export default function RootLayout() {
  const [syneLoaded] = useSyneFonts({ Syne_700Bold });
  const [dmLoaded] = useDmSansFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const fontsLoaded = syneLoaded && dmLoaded;

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.md,
        }}
      >
        <ProdifyWordmark size="splash" />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CrashBoundary scope="root">
            <DeepLinkGuard />
            <OfflineBanner />
            <NotificationNavBridge />
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="progression-overview"
                options={{
                  animation: "slide_from_right",
                  gestureEnabled: true,
                  gestureDirection: "horizontal",
                }}
              />
              <Stack.Screen
                name="challenge/[id]"
                options={{
                  animation: "slide_from_right",
                  gestureEnabled: true,
                  gestureDirection: "horizontal",
                }}
              />
              <Stack.Screen
                name="session-active"
                options={{
                  presentation: "fullScreenModal",
                  animation: "slide_from_bottom",
                  gestureDirection: "vertical",
                  gestureEnabled: true,
                }}
              />
            </Stack>
          </CrashBoundary>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
