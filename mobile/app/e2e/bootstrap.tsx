import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import {
  ONBOARDING_COMPLETE_KEY,
  WEEKLY_GOAL_CONFIGURED_KEY,
} from "../../constants/storageKeys";
import { colors, spacing } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { isE2eModeEnabled } from "../../lib/e2eMode";
import { clearPendingDeepLinkPath } from "../../lib/pendingDeepLink";

export default function E2eBootstrapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; password?: string }>();
  const { signIn } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isE2eModeEnabled()) {
        router.replace("/");
        return;
      }

      const email = typeof params.email === "string" ? params.email.trim() : "";
      const password = typeof params.password === "string" ? params.password : "";
      if (!email || !password) {
        console.warn("E2E bootstrap route missing email/password.");
        router.replace("/(auth)/login");
        return;
      }

      await AsyncStorage.multiSet([
        [ONBOARDING_COMPLETE_KEY, "1"],
        [WEEKLY_GOAL_CONFIGURED_KEY, "1"],
      ]);
      await clearPendingDeepLinkPath();
      await signIn(email, password);
      if (!cancelled) {
        router.replace("/(tabs)/dashboard");
      }
    };

    void run().catch((error) => {
      console.warn("E2E bootstrap route failed.", error);
      if (!cancelled) {
        router.replace("/(auth)/login");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [params.email, params.password, router, signIn]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.text}>Preparing E2E session...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  text: {
    color: colors.textSecondary,
  },
});
