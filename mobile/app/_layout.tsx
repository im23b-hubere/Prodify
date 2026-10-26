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
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LaunchOverlay } from "../components/brand/LaunchOverlay";
import { NotificationNavBridge } from "../components/NotificationNavBridge";
import { DeepLinkGuard } from "../components/DeepLinkGuard";
import { OfflineBanner } from "../components/OfflineBanner";
import { CrashBoundary } from "../components/ui/CrashBoundary";
import { AuthProvider } from "../context/AuthContext";
import { colors } from "../constants/theme";
import { ChallengeSyncBridge } from "../features/challenges/sync/ChallengeSyncBridge";
import { FriendsInboxBadgeSync } from "../features/friends/sync/FriendsInboxBadgeSync";
import { FriendsSyncBridge } from "../features/friends/sync/FriendsSyncBridge";
import { DuelClashHost } from "../features/duelClash/components/DuelClashHost";
import { appRootFillStyle, rootStackScreenOptions } from "../features/navigation/rootStackChrome";
import { initSentry } from "../lib/sentry";
import { configureNotificationHandler } from "../lib/streakNotifications";

SplashScreen.preventAutoHideAsync();
initSentry();
configureNotificationHandler();

export default function RootLayout() {
  const [syneLoaded] = useSyneFonts({ Syne_700Bold });
  const [dmLoaded] = useDmSansFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const fontsLoaded = syneLoaded && dmLoaded;

  // The native splash holds until the fonts are in; LaunchOverlay takes over in place.
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={appRootFillStyle} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <AuthProvider>
          <CrashBoundary scope="root">
            <DeepLinkGuard />
            <OfflineBanner />
            <NotificationNavBridge />
            <ChallengeSyncBridge />
            <FriendsSyncBridge />
            <FriendsInboxBadgeSync />
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="index" options={rootStackScreenOptions("index")} />
              <Stack.Screen name="(tabs)" options={rootStackScreenOptions("(tabs)")} />
              <Stack.Screen
                name="progression-overview"
                options={rootStackScreenOptions("progression-overview")}
              />
              <Stack.Screen name="skill-tree" options={rootStackScreenOptions("skill-tree")} />
              <Stack.Screen name="paywall" options={rootStackScreenOptions("paywall")} />
              <Stack.Screen
                name="notifications"
                options={rootStackScreenOptions("notifications")}
              />
              <Stack.Screen name="settings" options={rootStackScreenOptions("settings")} />
              <Stack.Screen
                name="blocked-users"
                options={rootStackScreenOptions("blocked-users")}
              />
              <Stack.Screen
                name="engagement-debug"
                options={rootStackScreenOptions("engagement-debug")}
              />
              <Stack.Screen name="weekly-recap" options={rootStackScreenOptions("weekly-recap")} />
              <Stack.Screen
                name="challenge/new"
                options={rootStackScreenOptions("challenge/new")}
              />
              <Stack.Screen
                name="challenge/[id]"
                options={rootStackScreenOptions("challenge/[id]")}
              />
              <Stack.Screen
                name="session-active"
                options={rootStackScreenOptions("session-active")}
              />
            </Stack>
            <DuelClashHost />
            <LaunchOverlay />
          </CrashBoundary>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
