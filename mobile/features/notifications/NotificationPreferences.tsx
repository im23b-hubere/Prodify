import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from "react-native";

import { SwipeSheet } from "../../components/ui/SwipeSheet";
import { colors } from "../../constants/theme";
import type { NotificationSettings } from "../../lib/notificationInbox";
import {
  DEFAULT_QUIET_HOURS,
  hasQuietHours,
  type NotificationPreferences as ServerPreferences,
} from "../../lib/notificationPreferences";
import { notificationStyles as styles } from "./notification.styles";
import type { NotificationPreferencesState } from "./useNotificationPreferences";

/** Tall enough for every group; the app sheet caps it on small phones and the list scrolls. */
const PREFERENCES_SHEET_HEIGHT = 760;

type Props = {
  t: TFunction;
  visible: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onUpdate: (patch: Partial<NotificationSettings>) => Promise<void>;
  server: NotificationPreferencesState;
};

type ServerCategory = keyof Pick<
  ServerPreferences,
  "streak" | "social" | "challenge" | "rank" | "reengagement"
>;

const SERVER_CATEGORIES: { key: ServerCategory; labelKey: string; hintKey?: string }[] = [
  { key: "streak", labelKey: "notificationsUi.streakReminders" },
  { key: "social", labelKey: "notificationsUi.socialUpdates" },
  { key: "challenge", labelKey: "notificationsUi.challengeUpdates" },
  { key: "rank", labelKey: "notificationsUi.rankProgress" },
  {
    key: "reengagement",
    labelKey: "notificationsUi.comebackNudges",
    hintKey: "notificationsUi.comebackNudgesHint",
  },
];

const enabledFrequency = (settings: NotificationSettings) =>
  settings.frequency === "off" ? ({ frequency: "all" } as const) : {};

const FREQUENCIES: { value: NotificationSettings["frequency"]; labelKey: string }[] = [
  { value: "all", labelKey: "notificationsUi.modeAll" },
  { value: "important", labelKey: "notificationsUi.modeImportant" },
  { value: "off", labelKey: "notificationsUi.modeOff" },
];

/** Notification preferences in the app's bottom sheet, opened from the inbox's gear. */
export function NotificationPreferences({
  t,
  visible,
  onClose,
  settings,
  onUpdate,
  server,
}: Props) {
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
        <ServerPreferencesGroup t={t} server={server} />

        <View>
          <Text style={styles.prefsGroupLabel}>{t("notificationsUi.prefsInApp")}</Text>
          <View style={styles.prefsCard}>
            <PreferenceSwitch
              label={t("notificationsUi.achievements")}
              value={settings.achievements}
              onChange={(achievements) =>
                onUpdate({ achievements, ...(achievements ? enabledFrequency(settings) : {}) })
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

function ServerPreferencesGroup({
  t,
  server,
}: {
  t: TFunction;
  server: NotificationPreferencesState;
}) {
  if (server.status === "idle") return null;
  return (
    <View>
      <Text style={styles.prefsGroupLabel}>{t("notificationsUi.prefsNotifyAbout")}</Text>
      <View style={styles.prefsCard}>
        <ServerPreferencesRows t={t} server={server} />
      </View>
      {server.saveFailed ? (
        <Text style={styles.prefsError} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {t("notificationsUi.prefsSaveFailed")}
        </Text>
      ) : null}
    </View>
  );
}

function ServerPreferencesRows({
  t,
  server,
}: {
  t: TFunction;
  server: NotificationPreferencesState;
}) {
  const { preferences, status, update, retry } = server;
  if (status === "error") {
    return (
      <View style={styles.prefsRow}>
        <Text style={[styles.prefsRowHint, styles.prefsRowCopy]}>
          {t("notificationsUi.prefsLoadFailed")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.tryAgain")}
          onPress={() => void retry()}
          style={({ pressed }) => [styles.serverErrorRetry, pressed && styles.pressed]}
        >
          <Text style={styles.serverErrorRetryText}>{t("common.tryAgain")}</Text>
        </Pressable>
      </View>
    );
  }
  if (!preferences) {
    return (
      <View style={styles.prefsRow} accessibilityLabel={t("notificationsUi.prefsLoading")}>
        <ActivityIndicator color={colors.textSecondary} />
        <Text style={styles.prefsRowHint}>{t("notificationsUi.prefsLoading")}</Text>
      </View>
    );
  }
  const smartOff = !preferences.smart_enabled;
  return (
    <>
      <PreferenceSwitch
        label={t("notificationsUi.smartNotifications")}
        hint={t("notificationsUi.smartNotificationsHint")}
        value={preferences.smart_enabled}
        onChange={(smart_enabled) => update({ smart_enabled })}
      />
      {SERVER_CATEGORIES.map(({ key, labelKey, hintKey }) => (
        <PreferenceSwitch
          key={key}
          divider
          disabled={smartOff}
          label={t(labelKey)}
          hint={hintKey ? t(hintKey) : undefined}
          value={preferences[key]}
          onChange={(enabled) => update({ [key]: enabled })}
        />
      ))}
      <PreferenceSwitch
        divider
        disabled={smartOff}
        label={t("notificationsUi.quietHours")}
        hint={t("notificationsUi.quietHoursHint")}
        value={hasQuietHours(preferences)}
        onChange={(enabled) =>
          update(
            enabled
              ? {
                  quiet_start_minute: DEFAULT_QUIET_HOURS.start,
                  quiet_end_minute: DEFAULT_QUIET_HOURS.end,
                }
              : { quiet_start_minute: 0, quiet_end_minute: 0 },
          )
        }
      />
    </>
  );
}

function PreferenceSwitch({
  label,
  hint,
  value,
  divider = false,
  disabled = false,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  divider?: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => Promise<void>;
}) {
  return (
    <View
      style={[
        styles.prefsRow,
        divider && styles.prefsRowDivider,
        disabled && styles.prefsRowDisabled,
      ]}
    >
      <View style={styles.prefsRowCopy}>
        <Text style={styles.prefsRowLabel}>{label}</Text>
        {hint ? <Text style={styles.prefsRowHint}>{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityState={{ disabled, checked: value }}
        disabled={disabled}
        value={value}
        onValueChange={(next) => void onChange(next)}
        trackColor={{ false: "#333", true: colors.primary }}
        thumbColor="#fafafa"
      />
    </View>
  );
}
