import { useEffect, useRef } from "react";

export type AuthScopeSnapshot = {
  token: string | null;
  userId: number | null | undefined;
};

/**
 * Feature state is scoped to the authenticated account (`userId`), not the
 * access token string (which rotates on refresh for the same user).
 */
export function shouldResetAuthScope(
  current: AuthScopeSnapshot,
  previous: AuthScopeSnapshot | null,
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

export function useAuthScopedReset(
  token: string | null,
  userId: number | null | undefined,
  onReset: () => void,
) {
  const previousRef = useRef<AuthScopeSnapshot | null>(null);
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  useEffect(() => {
    const current = { token, userId };
    if (shouldResetAuthScope(current, previousRef.current)) {
      onResetRef.current();
    }
    previousRef.current = current;
  }, [token, userId]);
}
