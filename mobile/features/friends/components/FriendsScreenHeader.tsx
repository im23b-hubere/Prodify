import * as Haptics from "expo-haptics";
import { UserPlus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RankHudChip } from "../../../components/progression/RankHudChip";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

type Props = {
  title: string;
  subtitle: string;
  tabOverviewLabel: string;
  tabToolsLabel: string;
  sectionTab: "overview" | "tools";
  onOpenAddFriend: () => void;
  onChangeTab: (tab: "overview" | "tools") => void;
  addFriendA11y: string;
};

export function FriendsScreenHeader({
  title,
  subtitle,
  tabOverviewLabel,
  tabToolsLabel,
  sectionTab,
  onOpenAddFriend,
  onChangeTab,
  addFriendA11y,
}: Props) {
  return (
    <>
      <View style={styles.topBar}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.screenSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.topActions}>
          <RankHudChip from="friends" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={addFriendA11y}
            style={styles.iconButton}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              onOpenAddFriend();
            }}
          >
            <UserPlus color={colors.textPrimary} size={18} />
          </Pressable>
        </View>
      </View>
      <View style={styles.segmentWrap}>
        <SegmentedControl
          options={[
            { value: "overview", label: tabOverviewLabel },
            { value: "tools", label: tabToolsLabel },
          ]}
          value={sectionTab}
          onChange={onChangeTab}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 0,
  },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  screenSubtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    lineHeight: 20,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentWrap: { marginBottom: spacing.lg },
});
