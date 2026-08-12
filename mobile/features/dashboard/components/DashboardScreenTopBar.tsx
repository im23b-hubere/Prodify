import * as Haptics from "expo-haptics";
import { Bell } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type { TFunction } from "i18next";

import { RankHudChip } from "../../../components/progression/RankHudChip";
import { ScreenHeader } from "../../../components/ui/ScreenHeader";
import { colors } from "../../../constants/theme";
import { styles } from "../dashboardScreen.styles";

type Props = {
  username: string | null | undefined;
  notificationUnreadCount: number;
  onOpenNotifications: () => void;
  t: TFunction;
};

export function DashboardScreenTopBar({
  username,
  notificationUnreadCount,
  onOpenNotifications,
  t,
}: Props) {
  const openNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onOpenNotifications();
  };

  return (
    <View style={styles.topBar}>
      <ScreenHeader
        titleNode={
          <View style={styles.greetingRow}>
            <Text style={styles.greetingPrefix}>{t("dashboard.heyPrefix")}</Text>
            <Text
              style={styles.greetingName}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {username ?? t("dashboard.defaultUserName")}
            </Text>
          </View>
        }
        actionNode={
          <View style={styles.headerActions}>
            <RankHudChip from="dashboard" />
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              onPress={openNotifications}
              accessibilityLabel={t("dashboard.notificationsA11y")}
            >
              <Bell color={colors.textPrimary} size={20} />
              {notificationUnreadCount > 0 ? <View style={styles.notifBadge} /> : null}
            </Pressable>
          </View>
        }
      />
    </View>
  );
}
