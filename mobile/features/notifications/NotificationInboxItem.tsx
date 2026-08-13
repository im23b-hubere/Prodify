import * as Haptics from "expo-haptics";
import { Flame, Lightbulb, Trophy, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { colors } from "../../constants/theme";
import { debugNav } from "../../lib/debugLog";
import type { InboxItem, NotificationCategory } from "../../lib/notificationInbox";
import { notificationStyles as styles } from "./notification.styles";
import {
  formatNotificationRelativeTime,
  NOTIFICATION_PRIORITY_LABELS,
  safeNotificationCategory,
} from "./notificationPresentation";

const CATEGORY_ICONS: Record<NotificationCategory, typeof Flame> = {
  streak: Flame,
  achievement: Trophy,
  social: Users,
  tips: Lightbulb,
};

type Props = {
  item: InboxItem;
  onOpenAction: (route: string) => void;
  onRemove: (id: string) => Promise<void>;
};

export function NotificationInboxItem({ item, onOpenAction, onRemove }: Props) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICONS[safeNotificationCategory(item.category)];
  const openAction = () => {
    if (!item.actionRoute) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      onOpenAction(item.actionRoute);
    } catch (error) {
      debugNav("inbox_action_push_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  };

  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable style={styles.deleteBtn} onPress={() => void onRemove(item.id)}>
          <Text style={styles.deleteTxt}>{t("notificationsUi.delete")}</Text>
        </Pressable>
      )}
    >
      <View style={[styles.card, !item.read && styles.cardUnread]}>
        <View style={styles.cardTop}>
          <View style={styles.iconWrap}>
            <Icon size={18} color={colors.primary} />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View style={styles.priorityChip}>
                <Text style={styles.priorityChipText}>
                  {t(NOTIFICATION_PRIORITY_LABELS[item.priority])}
                </Text>
              </View>
            </View>
            <Text style={styles.cardMsg}>{item.body}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.time}>{formatNotificationRelativeTime(item.createdAt, t)}</Text>
              {item.actionLabel && item.actionRoute ? (
                <Pressable onPress={openAction}>
                  <Text style={styles.action}>{item.actionLabel} →</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Swipeable>
  );
}
