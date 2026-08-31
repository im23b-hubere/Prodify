import { useEffect, useRef } from "react";

export type DashboardAuthSnapshot = {
  token: string | null;
  userId: number | null | undefined;
};

/**
 * Dashboard data is scoped to the authenticated account (`userId`), not the
 * access token string (which rotates on refresh for the same user).
 */
export function shouldResetDashboardAuth(
  current: DashboardAuthSnapshot,
  previous: DashboardAuthSnapshot | null,
): boolean {
  if (!previous) return false;

  if (!current.token) {
    return Boolean(previous.token ?? previous.userId);
  }

  if (current.userId != null && previous.userId != null && current.userId === previous.userId) {
    return false;
  }

  if (current.userId == null) {
    return previous.userId != null;
  }

  if (previous.userId == null) {
    return Boolean(previous.token && previous.token !== current.token);
  }

  return previous.userId !== current.userId;
}

export function useDashboardAuthReset(
  token: string | null,
  userId: number | null | undefined,
  onReset: () => void,
) {
  const previousRef = useRef<DashboardAuthSnapshot | null>(null);
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  useEffect(() => {
    const current = { token, userId };
    if (shouldResetDashboardAuth(current, previousRef.current)) {
      onResetRef.current();
    }
    previousRef.current = current;
  }, [token, userId]);
}
