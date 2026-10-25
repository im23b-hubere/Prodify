import { BellOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../constants/theme";
import { notificationStyles as styles } from "./notification.styles";
import { useNotificationPermission } from "./useNotificationPermission";

/**
 * Tells the producer when the OS hides Prodify's notifications, with the one way back that
 * works: the system prompt while it was never shown, the system settings after a refusal.
 */
export function NotificationPermissionBanner() {
  const { t } = useTranslation();
  const { status, request, openSettings } = useNotificationPermission();
  if (status !== "undetermined" && status !== "denied") return null;

  const declined = status === "denied";
  const actionLabel = t(
    declined ? "notificationsUi.permission.openSettings" : "notificationsUi.permission.enable",
  );
  return (
    <View style={styles.permissionBanner}>
      <BellOff color={colors.textSecondary} size={18} strokeWidth={2.2} />
      <View style={styles.permissionCopy}>
        <Text style={styles.permissionTitle}>{t("notificationsUi.permission.offTitle")}</Text>
        <Text style={styles.permissionBody}>
          {t(
            declined
              ? "notificationsUi.permission.declinedBody"
              : "notificationsUi.permission.undecidedBody",
          )}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        hitSlop={8}
        onPress={declined ? openSettings : () => void request()}
        style={({ pressed }) => [styles.permissionAction, pressed && styles.pressed]}
      >
        <Text style={styles.permissionActionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
