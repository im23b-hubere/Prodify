/** SecureStore: OAuth-style refresh token for renewing short-lived access JWTs. */
export const REFRESH_TOKEN_KEY = "prodify_refresh_token_v1";

/** Last streak value we showed — used to detect a broken streak on next load. */
export const LAST_KNOWN_STREAK_KEY = "prodify_last_known_streak_v1";
/** Highest milestone tier (days) we already celebrated with a toast. */
export const MILESTONE_CELEBRATED_MAX_KEY = "prodify_milestone_celebrated_max_v1";

/**
 * Expo SecureStore keys must only contain letters, numbers, dot, underscore, or hyphen.
 * Keep user-scoped suffixes aligned with that constraint.
 */
function withUserScope(baseKey: string, userId: number): string {
  return `${baseKey}_${userId}`;
}

export function userScopedLastKnownStreakKey(userId: number): string {
  return withUserScope(LAST_KNOWN_STREAK_KEY, userId);
}

export function userScopedMilestoneCelebratedKey(userId: number): string {
  return withUserScope(MILESTONE_CELEBRATED_MAX_KEY, userId);
}

export const ONBOARDING_COMPLETE_KEY = "prodify_onboarding_done_v1";
export const NOTIFICATION_INBOX_KEY = "prodify_notification_inbox_v1";
export const NOTIFICATION_UNREAD_KEY = "prodify_notification_unread_v1";
export const NOTIFICATION_SETTINGS_KEY = "prodify_notification_settings_v1";
