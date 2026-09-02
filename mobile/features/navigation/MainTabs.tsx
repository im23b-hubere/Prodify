import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { BarChart3, LayoutGrid, UserRound, Users } from "lucide-react-native";
import type { ComponentPropsWithoutRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../constants/theme";

const MAIN_TABS = [
  { name: "dashboard", titleKey: "tabs.dashboard", testID: "tab-dashboard", icon: LayoutGrid },
  { name: "stats", titleKey: "tabs.stats", testID: "tab-stats", icon: BarChart3 },
  { name: "friends", titleKey: "tabs.friends", testID: "tab-friends", icon: Users },
  { name: "profile", titleKey: "tabs.profile", testID: "tab-profile", icon: UserRound },
] as const;

type PressableProps = ComponentPropsWithoutRef<typeof Pressable>;

function TabBarButton({ testID, ...props }: BottomTabBarButtonProps & { testID: string }) {
  return <Pressable {...(props as PressableProps)} testID={testID} accessibilityRole="button" />;
}

export function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        lazy: true,
        headerShown: false,
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
      {MAIN_TABS.map(({ name, titleKey, testID, icon: Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(titleKey),
            tabBarButton: (props) => <TabBarButton {...props} testID={testID} />,
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.tabIconWrap}>
                <View style={focused ? styles.activeDot : styles.dotSpacer} />
                <Icon size={20} color={color} strokeWidth={2.2} />
              </View>
            ),
          }}
        />
      ))}
      <Tabs.Screen name="session-trash" options={{ href: null, title: t("tabs.sessionTrash") }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
