import * as Haptics from "expo-haptics";
import {
  Flame,
  Lightbulb,
  MessageCircle,
  Swords,
  Trophy,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { colors } from "../../constants/theme";
import { debugNav } from "../../lib/debugLog";
import type { InboxItem } from "../../lib/notificationInbox";
import { notificationStyles as styles } from "./notification.styles";
import {
  formatNotificationRelativeTime,
  notificationKind,
  type NotificationKind,
} from "./notificationPresentation";

const SOCIAL_BLUE = "#6b9bff";

const KIND_LOOK: Record<NotificationKind, { Icon: LucideIcon; color: string }> = {
  challenge: { Icon: Swords, color: colors.primary },
  comment: { Icon: MessageCircle, color: SOCIAL_BLUE },
  friend: { Icon: UserPlus, color: SOCIAL_BLUE },
  social: { Icon: Users, color: SOCIAL_BLUE },
  streak: { Icon: Flame, color: colors.primary },
  achievement: { Icon: Trophy, color: "#a259ff" },
  tips: { Icon: Lightbulb, color: "#eab308" },
};

type Props = {
  item: InboxItem;
  /** Unread when the inbox opened; opening marks everything read, so the view remembers. */
  isNew: boolean;
  onOpenAction: (route: string) => void;
  onRemove: (id: string) => Promise<void>;
};

/** One flat row: what it is, what happened, when. The whole row opens it. */
export const NotificationInboxItem = memo(function NotificationInboxItem({
  item,
  isNew,
  onOpenAction,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const { Icon, color } = KIND_LOOK[notificationKind(item)];
  const route = item.actionRoute;
  const openAction = () => {
    if (!route) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      onOpenAction(route);
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
      <Pressable
        accessibilityRole={route ? "button" : undefined}
        accessibilityHint={route ? item.actionLabel : undefined}
        disabled={!route}
        onPress={openAction}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        testID={`notification-${item.id}`}
      >
        <View style={[styles.icon, { backgroundColor: `${color}1f` }]}>
          <Icon size={19} color={color} strokeWidth={2.2} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowBody} numberOfLines={2}>
            {item.body}
          </Text>
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.time}>{formatNotificationRelativeTime(item.createdAt, t)}</Text>
          {isNew ? <View style={styles.unreadDot} testID="notification-unread-dot" /> : null}
        </View>
      </Pressable>
    </Swipeable>
  );
});
