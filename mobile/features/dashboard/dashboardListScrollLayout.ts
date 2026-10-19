import type { StyleProp, ViewStyle } from "react-native";

import { ui } from "../../constants/theme";

type DashboardListScrollLayoutInput = {
  bottomInset: number;
  recentSessionCount: number;
};

/**
 * FlatList layout for the dashboard session list.
 * Short lists (especially exactly one session) must not stretch to the viewport
 * via flexGrow — that puts contentSize ≈ layout height and breaks iOS bounce/scroll.
 * Bottom padding clears the tab bar the same way Profile does.
 */
export function buildDashboardListScrollLayout({
  bottomInset,
  recentSessionCount,
}: DashboardListScrollLayoutInput): {
  style: StyleProp<ViewStyle>;
  contentInsetAdjustmentBehavior: "never";
  contentContainerStyle: ViewStyle;
} {
  const contentContainerStyle: ViewStyle = {
    paddingHorizontal: ui.screenPadding,
    paddingBottom: bottomInset + ui.tabBarClearance,
  };
  if (recentSessionCount === 0) {
    contentContainerStyle.flexGrow = 1;
  }

  return {
    style: { flex: 1 },
    contentInsetAdjustmentBehavior: "never",
    contentContainerStyle,
  };
}
