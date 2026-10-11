import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import { SwipeSheet } from "../../components/ui/SwipeSheet";
import { colors } from "../../constants/theme";
import type { NotificationSettings } from "../../lib/notificationInbox";
import { notificationStyles as styles } from "./notification.styles";

/** Tall enough for both groups and the delivery switch; the app sheet caps it on small phones. */
const PREFERENCES_SHEET_HEIGHT = 640;

type Props = {
  t: TFunction;
  visible: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onUpdate: (patch: Partial<NotificationSettings>) => Promise<void>;
};

const enabledFrequency = (settings: NotificationSettings) =>
  settings.frequency === "off" ? ({ frequency: "all" } as const) : {};

const FREQUENCIES: { value: NotificationSettings["frequency"]; labelKey: string }[] = [
  { value: "all", labelKey: "notificationsUi.modeAll" },
  { value: "important", labelKey: "notificationsUi.modeImportant" },
  { value: "off", labelKey: "notificationsUi.modeOff" },
];

/** Notification preferences in the app's bottom sheet, opened from the inbox's gear. */
export function NotificationPreferences({ t, visible, onClose, settings, onUpdate }: Props) {
  const quietHoursOn = settings.quietStartHour === 23 && settings.quietEndHour === 7;
  return (
    <SwipeSheet
      visible={visible}
      onClose={onClose}
      closeLabel={t("common.close")}
      dragAnywhere={false}
      height={PREFERENCES_SHEET_HEIGHT}
      header={
        <Text style={styles.prefsTitle} accessibilityRole="header">
          {t("notificationsUi.preferences")}
        </Text>
      }
    >
      <ScrollView
        style={styles.prefsScroll}
        contentContainerStyle={styles.prefsContent}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.prefsGroupLabel}>{t("notificationsUi.prefsNotifyAbout")}</Text>
          <View style={styles.prefsCard}>
            <PreferenceSwitch
              label={t("notificationsUi.streakReminders")}
              value={settings.streak}
              onChange={(streak) =>
                onUpdate({ streak, ...(streak ? enabledFrequency(settings) : {}) })
              }
            />
            <PreferenceSwitch
              divider
              label={t("notificationsUi.achievements")}
              value={settings.achievements}
              onChange={(achievements) =>
                onUpdate({ achievements, ...(achievements ? enabledFrequency(settings) : {}) })
              }
            />
            <PreferenceSwitch
              divider
              label={t("notificationsUi.socialUpdates")}
              value={settings.social}
              onChange={(social) =>
                onUpdate({ social, ...(social ? enabledFrequency(settings) : {}) })
              }
            />
            <PreferenceSwitch
              divider
              label={t("notificationsUi.tipsAndNudges")}
              hint={t("notificationsUi.tipsAndNudgesHint")}
              value={settings.tips}
              onChange={(tips) => onUpdate({ tips, ...(tips ? enabledFrequency(settings) : {}) })}
            />
          </View>
        </View>

        <View>
          <Text style={styles.prefsGroupLabel}>{t("notificationsUi.prefsDelivery")}</Text>
          <View style={styles.prefsCard}>
            <PreferenceSwitch
              label={t("notificationsUi.quietHours")}
              value={quietHoursOn}
              onChange={(enabled) =>
                onUpdate(
                  enabled
                    ? { quietStartHour: 23, quietEndHour: 7 }
                    : { quietStartHour: 0, quietEndHour: 0 },
                )
              }
            />
          </View>
        </View>

        <View>
          <Text style={styles.prefsGroupLabel}>{t("notificationsUi.deliveryMode")}</Text>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {FREQUENCIES.map(({ value, labelKey }) => {
              const on = settings.frequency === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    if (on) return;
                    Haptics.selectionAsync().catch(() => undefined);
                    void onUpdate({ frequency: value });
                  }}
                  style={[styles.segmentOption, on && styles.segmentOptionOn]}
                >
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                    {t(labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SwipeSheet>
  );
}

function PreferenceSwitch({
  label,
  hint,
  value,
  divider = false,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  divider?: boolean;
  onChange: (value: boolean) => Promise<void>;
}) {
  return (
    <View style={[styles.prefsRow, divider && styles.prefsRowDivider]}>
      <View style={styles.prefsRowCopy}>
        <Text style={styles.prefsRowLabel}>{label}</Text>
        {hint ? <Text style={styles.prefsRowHint}>{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={(next) => void onChange(next)}
        trackColor={{ false: "#333", true: colors.primary }}
        thumbColor="#fafafa"
      />
    </View>
  );
}
