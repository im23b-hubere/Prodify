import { Redirect, Tabs } from "expo-router";
import { BarChart3, LayoutGrid, UserRound, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ProdifyWordmark } from "../../components/brand/ProdifyWordmark";
import { colors, spacing } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useStreakReconcileOnForeground } from "../../hooks/useStreakReconcileOnForeground";
import { peekCachedHasPremiumAccess } from "../../lib/billing";
import { resolvePremiumAccess } from "../../lib/premiumAccess";

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

export default function TabsLayout() {
  const { t } = useTranslation();
  const { token, user, hydrated } = useAuth();
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useStreakReconcileOnForeground(token);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setHasAccess(null);
      setEntitlementLoading(false);
      return;
    }

    const cachedAccess = peekCachedHasPremiumAccess(token);
    if (cachedAccess === true) {
      setHasAccess(true);
      setEntitlementLoading(false);
    } else {
      // Never block on cached "free" — dev bypass / RevenueCat may still grant access.
      setHasAccess(null);
      setEntitlementLoading(true);
    }

    void resolvePremiumAccess(token, user?.id != null ? String(user.id) : null)
      .then((access) => {
        if (!cancelled) {
          setHasAccess(access);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasAccess(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setEntitlementLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

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
    return <Redirect href="/(auth)/register" />;
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
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} icon="dashboard" />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t("tabs.stats"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} icon="stats" />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t("tabs.friends"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} icon="friends" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
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
