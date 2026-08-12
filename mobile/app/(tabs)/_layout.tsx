import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ProdifyWordmark } from "../../components/brand/ProdifyWordmark";
import { colors, spacing } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { MainTabs } from "../../features/navigation/MainTabs";
import { usePremiumTabAccess } from "../../features/navigation/usePremiumTabAccess";
import { useStreakReconcileOnForeground } from "../../hooks/useStreakReconcileOnForeground";

export default function TabsLayout() {
  const { token, user, hydrated } = useAuth();
  const { hasAccess, waitingForAccess } = usePremiumTabAccess({
    token,
    userId: user?.id,
    userIsPremium: Boolean(user?.is_premium),
  });

  useStreakReconcileOnForeground(token);

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
  return <MainTabs />;
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
