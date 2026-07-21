import { Redirect, Tabs } from "expo-router";
import { BarChart3, LayoutGrid, UserRound, Users } from "lucide-react-native";
import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

import { ProdifyWordmark } from "../../components/brand/ProdifyWordmark";
import { colors, spacing } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useStreakReconcileOnForeground } from "../../hooks/useStreakReconcileOnForeground";
import { peekCachedHasPremiumAccess, peekStoredHasPremiumAccess } from "../../lib/billing";
import { isDevBillingBypassActive } from "../../lib/devBillingBypass";
import { isE2eModeEnabled } from "../../lib/e2eMode";
import { resolvePremiumAccess } from "../../lib/premiumAccess";

/** Hard cap so cold starts never sit on the splash longer than this. */
const ENTITLEMENT_BOOT_TIMEOUT_MS = 6_000;

type TabIconProps = {
  focused: boolean;
  color: string;
  icon: "dashboard" | "stats" | "friends" | "profile";
};

function TabIcon({ focused, color, icon }: TabIconProps) {
  const Icon = {
    dashboard: LayoutGrid,
    stats: BarChart3,
    friends: Users,
    profile: UserRound,
  }[icon];

  return (
    <View style={styles.tabIconWrap}>
      {focused ? <View style={styles.activeDot} /> : <View style={styles.dotSpacer} />}
      <Icon size={20} color={color} strokeWidth={2.2} />
    </View>
  );
}

function timeoutAccessFallback(ms: number, fallback: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(fallback), ms);
  });
}

type PressableProps = ComponentPropsWithoutRef<typeof Pressable>;

function TabBarButton({ testID, ...props }: BottomTabBarButtonProps & { testID: string }) {
  return <Pressable {...(props as PressableProps)} testID={testID} accessibilityRole="button" />;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { token, user, hydrated } = useAuth();
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useStreakReconcileOnForeground(token);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAccess() {
      if (!token) {
        setHasAccess(null);
        setEntitlementLoading(false);
        return;
      }

      if (isE2eModeEnabled()) {
        setHasAccess(true);
        setEntitlementLoading(false);
        return;
      }

      const bypass = await isDevBillingBypassActive().catch(() => false);
      if (cancelled) return;
      if (bypass) {
        setHasAccess(true);
        setEntitlementLoading(false);
        return;
      }

      let fastAccess: boolean | null = user?.is_premium ? true : peekCachedHasPremiumAccess(token);
      if (fastAccess == null && user?.id != null) {
        const storedPremium = await peekStoredHasPremiumAccess(user.id).catch(() => false);
        if (cancelled) return;
        if (storedPremium) {
          fastAccess = true;
        }
      }

      if (fastAccess !== null) {
        setHasAccess(fastAccess);
        setEntitlementLoading(false);
      } else {
        setHasAccess(null);
        setEntitlementLoading(true);
      }

      const resolved = await Promise.race([
        resolvePremiumAccess(token, user?.id != null ? String(user.id) : null),
        timeoutAccessFallback(ENTITLEMENT_BOOT_TIMEOUT_MS, fastAccess === true),
      ]);
      if (cancelled) return;
      setHasAccess(resolved);
      setEntitlementLoading(false);
    }

    void bootstrapAccess();
    return () => {
      cancelled = true;
    };
  }, [token, user?.id, user?.is_premium]);

  const waitingForEntitlement = Boolean(token) && entitlementLoading && hasAccess == null;

  if (!hydrated || waitingForEntitlement) {
    return (
      <View style={styles.center}>
        <ProdifyWordmark size="splash" style={styles.bootWordmark} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!hasAccess) {
    return <Redirect href={{ pathname: "/paywall", params: { source: "post_auth" } }} />;
  }

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        lazy: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: "Syne_700Bold", fontSize: 20 },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 72,
          paddingTop: spacing.xs,
          paddingBottom: spacing.sm,
        },
        tabBarLabelStyle: { fontSize: 12, fontFamily: "DMSans_500Medium" },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        sceneStyle: { backgroundColor: colors.background },
        animation: "none",
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("tabs.dashboard"),
          tabBarButton: (props) => <TabBarButton {...props} testID="tab-dashboard" />,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} icon="dashboard" />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t("tabs.stats"),
          tabBarButton: (props) => <TabBarButton {...props} testID="tab-stats" />,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} icon="stats" />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t("tabs.friends"),
          tabBarButton: (props) => <TabBarButton {...props} testID="tab-friends" />,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} icon="friends" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarButton: (props) => <TabBarButton {...props} testID="tab-profile" />,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} icon="profile" />
          ),
        }}
      />
      <Tabs.Screen
        name="session-trash"
        options={{
          href: null,
          title: t("tabs.sessionTrash"),
        }}
      />
    </Tabs>
  );
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
  tabIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  dotSpacer: {
    width: 6,
    height: 6,
  },
});
