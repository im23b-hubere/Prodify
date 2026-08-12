import type { TFunction } from "i18next";
import { Pressable, Switch, Text, View } from "react-native";

import type { NotificationSettings } from "../../lib/notificationInbox";
import { notificationStyles as styles } from "./notification.styles";

type Props = {
  t: TFunction;
  settings: NotificationSettings;
  onUpdate: (patch: Partial<NotificationSettings>) => Promise<void>;
};

const enabledFrequency = (settings: NotificationSettings) =>
  settings.frequency === "off" ? ({ frequency: "all" } as const) : {};

export function NotificationPreferences({ t, settings, onUpdate }: Props) {
  return (
    <View style={styles.settings}>
      <Text style={styles.settingsTitle}>{t("notificationsUi.preferences")}</Text>
      <PreferenceSwitch
        label={t("notificationsUi.streakReminders")}
        value={settings.streak}
        activeColor="rgba(255,61,0,0.45)"
        onChange={(streak) => onUpdate({ streak, ...(streak ? enabledFrequency(settings) : {}) })}
      />
      <PreferenceSwitch
        label={t("notificationsUi.achievements")}
        value={settings.achievements}
        activeColor="rgba(162,89,255,0.45)"
        onChange={(achievements) =>
          onUpdate({ achievements, ...(achievements ? enabledFrequency(settings) : {}) })
        }
      />
      <PreferenceSwitch
        label={t("notificationsUi.socialUpdates")}
        value={settings.social}
        activeColor="rgba(59,130,246,0.45)"
        onChange={(social) => onUpdate({ social, ...(social ? enabledFrequency(settings) : {}) })}
      />
      <PreferenceSwitch
        label={t("notificationsUi.tipsAndNudges")}
        hint={t("notificationsUi.tipsAndNudgesHint")}
        value={settings.tips}
        activeColor="rgba(234,179,8,0.45)"
        onChange={(tips) => onUpdate({ tips, ...(tips ? enabledFrequency(settings) : {}) })}
      />
      <PreferenceSwitch
        label={t("notificationsUi.quietHours")}
        value={settings.quietStartHour === 23 && settings.quietEndHour === 7}
        activeColor="rgba(255,255,255,0.2)"
        onChange={(enabled) =>
          onUpdate(
            enabled
              ? { quietStartHour: 23, quietEndHour: 7 }
              : { quietStartHour: 0, quietEndHour: 0 },
          )
        }
      />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t("notificationsUi.deliveryMode")}</Text>
        <Pressable
          style={styles.modeChip}
          onPress={() =>
            void onUpdate({
              frequency:
                settings.frequency === "all"
                  ? "important"
                  : settings.frequency === "important"
                    ? "off"
                    : "all",
            })
          }
        >
          <Text style={styles.modeChipText}>
            {settings.frequency === "all"
              ? t("notificationsUi.modeAll")
              : settings.frequency === "important"
                ? t("notificationsUi.modeImportant")
                : t("notificationsUi.modeOff")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PreferenceSwitch({
  label,
  hint,
  value,
  activeColor,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  activeColor: string;
  onChange: (value: boolean) => Promise<void>;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => void onChange(next)}
        trackColor={{ false: "#333", true: activeColor }}
        thumbColor="#fafafa"
      />
    </View>
  );
}
