import { Tabs } from "expo-router";
import { BarChart3, LayoutGrid, UserRound, Users } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../constants/theme";

type TabIconProps = {
  focused: boolean;
  color: string;
  icon: "dashboard" | "stats" | "friends" | "profil";
};

function TabIcon({ focused, color, icon }: TabIconProps) {
  const Icon = {
    dashboard: LayoutGrid,
    stats: BarChart3,
    friends: Users,
    profil: UserRound,
  }[icon];

  return (
    <View style={styles.tabIconWrap}>
      {focused ? <View style={styles.activeDot} /> : <View style={styles.dotSpacer} />}
      <Icon size={20} color={color} strokeWidth={2.2} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
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
        animation: "fade",
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} icon="dashboard" />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} icon="stats" />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} icon="friends" />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} icon="profil" />,
        }}
      />
      <Tabs.Screen
        name="session-trash"
        options={{
          href: null,
          title: "Session Trash",
        }}
      />
      <Tabs.Screen
        name="session/[id]"
        options={{
          href: null,
          title: "Session Detail",
        }}
      />
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
