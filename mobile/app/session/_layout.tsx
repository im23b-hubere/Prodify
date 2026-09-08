import { Stack } from "expo-router";

import { colors } from "../../constants/theme";
import { AppAccessGate } from "../../features/navigation/AppAccessGate";

export default function SessionStackLayout() {
  return (
    <AppAccessGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen
          name="setup"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="active"
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
            gestureDirection: "vertical",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen name="complete" />
        <Stack.Screen name="history" />
        <Stack.Screen name="[id]" />
      </Stack>
    </AppAccessGate>
  );
}
