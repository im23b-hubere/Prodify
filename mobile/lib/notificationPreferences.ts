import { apiJson } from "./client";
import type { NotificationSettings } from "./notificationTypes";

const PREFERENCES_PATH = "/users/me/notification-preferences";

/** What the server checks before every push. Quiet minutes are local minutes since midnight. */
export type NotificationPreferences = {
  smart_enabled: boolean;
  streak: boolean;
  social: boolean;
  challenge: boolean;
  rank: boolean;
  reengagement: boolean;
  quiet_start_minute: number;
  quiet_end_minute: number;
};

export type NotificationPreferencesResponse = NotificationPreferences & {
  /** False until preferences were saved once for this account. */
  customized: boolean;
};

export const DEFAULT_QUIET_HOURS = { start: 22 * 60 + 30, end: 8 * 60 } as const;

export function hasQuietHours(prefs: NotificationPreferences): boolean {
  return prefs.quiet_start_minute !== prefs.quiet_end_minute;
}

export function fetchNotificationPreferences(
  token: string,
): Promise<NotificationPreferencesResponse> {
  return apiJson<NotificationPreferencesResponse>(PREFERENCES_PATH, { token });
}

export function saveNotificationPreferences(
  token: string,
  prefs: NotificationPreferences,
): Promise<NotificationPreferencesResponse> {
  return apiJson<NotificationPreferencesResponse>(PREFERENCES_PATH, {
    method: "PUT",
    token,
    body: prefs,
  });
}

/**
 * The server equivalent of settings older app versions kept on the device. Quiet hours were
 * off by default there, so only quiet hours the producer switched on replace the server default.
 */
export function preferencesFromLegacySettings(
  settings: NotificationSettings,
): NotificationPreferences {
  const hadQuietHours = settings.quietStartMinute !== settings.quietEndMinute;
  return {
    smart_enabled: settings.frequency !== "off",
    streak: settings.streak,
    social: settings.social,
    challenge: settings.tips,
    rank: settings.tips,
    reengagement: settings.tips,
    quiet_start_minute: hadQuietHours ? settings.quietStartMinute : DEFAULT_QUIET_HOURS.start,
    quiet_end_minute: hadQuietHours ? settings.quietEndMinute : DEFAULT_QUIET_HOURS.end,
  };
}

/** The device inbox filter, kept in step with the categories the server also controls. */
export function withServerPreferences(
  settings: NotificationSettings,
  prefs: NotificationPreferences,
): NotificationSettings {
  return {
    ...settings,
    streak: prefs.streak,
    social: prefs.social,
    quietStartMinute: prefs.quiet_start_minute,
    quietEndMinute: prefs.quiet_end_minute,
  };
}
