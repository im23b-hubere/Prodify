import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ProdifyWordmark } from "../../components/brand/ProdifyWordmark";
import { colors, spacing } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { usePremiumAccess } from "./usePremiumAccess";

/**
 * Prodify is subscription-only, so every screen outside auth, onboarding, legal
 * and the paywall itself must sit behind this gate. Route folders that own a
 * layout wrap their `Stack`; standalone screens wrap their own component.
 */
export function AppAccessGate({ children }: { children: ReactNode }) {
  const { token, user, hydrated } = useAuth();
  const { hasAccess, waitingForAccess } = usePremiumAccess({
    token,
    userId: user?.id,
    userIsPremium: Boolean(user?.is_premium),
  });

  if (!hydrated || waitingForAccess) {
    return (
      <View style={styles.center}>
        <ProdifyWordmark size="splash" style={styles.bootWordmark} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!hasAccess) {
    return <Redirect href={{ pathname: "/paywall", params: { source: "post_auth" } }} />;
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  bootWordmark: {
    marginBottom: spacing.xs,
  },
});
