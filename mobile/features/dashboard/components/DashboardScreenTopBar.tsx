import * as Haptics from "expo-haptics";
import { Bell } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type { TFunction } from "i18next";

import { colors } from "../../../constants/theme";
import { dashboardGreetingKey } from "../dashboardCopy";
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
    <View style={styles.heroHeader}>
      <View style={styles.topBar}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingKicker}>{t(dashboardGreetingKey())}</Text>
          <Text style={styles.greetingName} numberOfLines={1}>
            {username ?? t("dashboard.defaultUserName")}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            onPress={openNotifications}
            accessibilityLabel={t("dashboard.notificationsA11y")}
          >
            <Bell color={colors.textPrimary} size={18} />
            {notificationUnreadCount > 0 ? <View style={styles.notifBadge} /> : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
