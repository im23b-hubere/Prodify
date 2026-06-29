import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { colors } from "../constants/theme";

import { useAuth } from "../context/AuthContext";
import { readOnboardingComplete, resolvePostAuthRoute, toHref } from "../lib/postAuthNavigation";

export default function Index() {
  const { token, hydrated } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    readOnboardingComplete()
      .then((done) => setOnboarded(done))
      .catch(() => setOnboarded(false));
  }, []);

  if (!hydrated || onboarded === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const route = resolvePostAuthRoute({
    hasToken: Boolean(token),
    onboardingComplete: onboarded,
    entryPoint: "app_launch",
    allowPaywallPrompt: false,
  });

  return <Redirect href={toHref(route)} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});
