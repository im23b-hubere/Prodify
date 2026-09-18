import * as Sentry from "@sentry/react-native";
import { DarkTheme, Tabs, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { BarChart3, House, UserRound, Users } from "lucide-react-native";
import { Component, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../constants/theme";

const IOS_MAJOR_VERSION = Platform.OS === "ios" ? parseInt(String(Platform.Version), 10) || 0 : 0;
// The native UITabBar only renders as Liquid Glass on iOS 26+; older devices keep the JS tab bar.
const USE_NATIVE_TABS = IOS_MAJOR_VERSION >= 26;

const MAIN_TABS = [
  {
    name: "dashboard",
    titleKey: "tabs.dashboard",
    testID: "tab-dashboard",
    icon: House,
    sf: { default: "house", selected: "house.fill" },
  },
  {
    name: "stats",
    titleKey: "tabs.stats",
    testID: "tab-stats",
    icon: BarChart3,
    sf: { default: "chart.bar", selected: "chart.bar.fill" },
  },
  {
    name: "friends",
    titleKey: "tabs.friends",
    testID: "tab-friends",
    icon: Users,
    sf: { default: "person.2", selected: "person.2.fill" },
  },
  {
    name: "profile",
    titleKey: "tabs.profile",
    testID: "tab-profile",
    icon: UserRound,
    sf: { default: "person.crop.circle", selected: "person.crop.circle.fill" },
  },
] as const;

const NATIVE_TABS_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
  },
};

type PressableProps = ComponentPropsWithoutRef<typeof Pressable>;

function TabBarButton({ testID, ...props }: PressableProps & { testID: string }) {
  return <Pressable {...props} testID={testID} accessibilityRole="button" />;
}

function LiquidGlassTabs() {
  const { t } = useTranslation();
  return (
    <ThemeProvider value={NATIVE_TABS_THEME}>
      <NativeTabs
        tintColor={colors.textPrimary}
        iconColor={{ default: colors.textSecondary, selected: colors.textPrimary }}
        labelStyle={{ fontFamily: "DMSans_500Medium", fontSize: 11 }}
        disableTransparentOnScrollEdge
        minimizeBehavior="never"
      >
        {MAIN_TABS.map(({ name, titleKey, testID, sf }) => (
          <NativeTabs.Trigger key={name} name={name} testID={testID}>
            <NativeTabs.Trigger.Icon sf={sf} />
            <NativeTabs.Trigger.Label>{t(titleKey)}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
        <NativeTabs.Trigger name="session-trash" hidden />
      </NativeTabs>
    </ThemeProvider>
  );
}

function ClassicTabs() {
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
        tabBarActiveTintColor: colors.textPrimary,
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
            tabBarButton: (props) => (
              <TabBarButton {...(props as PressableProps)} testID={testID} />
            ),
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

class NativeTabsErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error, { tags: { area: "native-tabs" } });
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function MainTabs() {
  if (!USE_NATIVE_TABS) {
    return <ClassicTabs />;
  }
  return (
    <NativeTabsErrorBoundary fallback={<ClassicTabs />}>
      <LiquidGlassTabs />
    </NativeTabsErrorBoundary>
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
    backgroundColor: colors.textPrimary,
  },
  dotSpacer: {
    width: 6,
    height: 6,
  },
});
