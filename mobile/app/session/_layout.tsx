import { Stack } from "expo-router";

import { colors } from "../../constants/theme";

export default function SessionStackLayout() {
  return (
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
        }}
      />
      <Stack.Screen name="complete" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
