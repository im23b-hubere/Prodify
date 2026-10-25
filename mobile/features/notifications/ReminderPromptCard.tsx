import { BellRing } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { TextButton } from "../../components/ui/TextButton";
import { colors, motion } from "../../constants/theme";
import { notificationStyles as styles } from "./notification.styles";
import { useReminderPrompt } from "./useReminderPrompt";

/** Invites the producer to turn reminders on, right after a session, before the system prompt. */
export function ReminderPromptCard() {
  const { t } = useTranslation();
  const { visible, accept, dismiss } = useReminderPrompt();
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.standard)}
      style={styles.reminderCard}
      testID="reminder-prompt-card"
    >
      <View style={styles.reminderHeader}>
        <BellRing color={colors.primary} size={20} strokeWidth={2.2} />
        <Text style={styles.reminderTitle} accessibilityRole="header">
          {t("notificationsUi.permission.promptTitle")}
        </Text>
      </View>
      <Text style={styles.reminderBody}>{t("notificationsUi.permission.promptBody")}</Text>
      <View style={styles.reminderActions}>
        <PrimaryButton
          label={t("notificationsUi.permission.promptAccept")}
          onPress={() => void accept()}
        />
        <TextButton
          label={t("notificationsUi.permission.promptDismiss")}
          onPress={() => void dismiss()}
          subdued
        />
      </View>
    </Animated.View>
  );
}
