import "react-native-gesture-handler";
import "react-native-reanimated";

import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, useFonts as useDmSansFonts } from "@expo-google-fonts/dm-sans";
import { Syne_700Bold, useFonts as useSyneFonts } from "@expo-google-fonts/syne";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../context/AuthContext";
import { colors } from "../constants/theme";

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
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
