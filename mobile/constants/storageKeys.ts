/** Last streak value we showed — used to detect a broken streak on next load. */
export const LAST_KNOWN_STREAK_KEY = "beattrack_last_known_streak_v1";
/** Highest milestone tier (days) we already celebrated with a toast. */
export const MILESTONE_CELEBRATED_MAX_KEY = "beattrack_milestone_celebrated_max_v1";

export function userScopedLastKnownStreakKey(userId: number): string {
  return `${LAST_KNOWN_STREAK_KEY}:${userId}`;
}

export function userScopedMilestoneCelebratedKey(userId: number): string {
  return `${MILESTONE_CELEBRATED_MAX_KEY}:${userId}`;
}

export const ONBOARDING_COMPLETE_KEY = "beattrack_onboarding_done_v1";
export const NOTIFICATION_INBOX_KEY = "beattrack_notification_inbox_v1";
export const NOTIFICATION_UNREAD_KEY = "beattrack_notification_unread_v1";
export const NOTIFICATION_SETTINGS_KEY = "beattrack_notification_settings_v1";
