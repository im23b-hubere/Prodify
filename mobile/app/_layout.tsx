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
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { NotificationNavBridge } from "../components/NotificationNavBridge";
import { DeepLinkGuard } from "../components/DeepLinkGuard";
import { OfflineBanner } from "../components/OfflineBanner";
import { XpHud } from "../components/progression/XpHud";
import { AuthProvider } from "../context/AuthContext";
import { colors } from "../constants/theme";
import { initSentry } from "../lib/sentry";
import { configureNotificationHandler } from "../lib/streakNotifications";

initSentry();
configureNotificationHandler();

export default function RootLayout() {
  const [syneLoaded] = useSyneFonts({ Syne_700Bold });
  const [dmLoaded] = useDmSansFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const fontsLoaded = syneLoaded && dmLoaded;

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <DeepLinkGuard />
          <OfflineBanner />
          <NotificationNavBridge />
          <XpHud />
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
