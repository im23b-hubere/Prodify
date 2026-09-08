import { Stack } from "expo-router";

import { colors } from "../../constants/theme";
import { AppAccessGate } from "../../features/navigation/AppAccessGate";

export default function StreakStackLayout() {
  return (
    <AppAccessGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="history" />
      </Stack>
    </AppAccessGate>
  );
}
