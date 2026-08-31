import {
  shouldResetAuthScope,
  useAuthScopedReset,
  type AuthScopeSnapshot,
} from "../../../lib/authScopedReset";

export type DashboardAuthSnapshot = AuthScopeSnapshot;

/** @deprecated Use `shouldResetAuthScope` from `lib/authScopedReset`. */
export const shouldResetDashboardAuth = shouldResetAuthScope;

/** @deprecated Use `useAuthScopedReset` from `lib/authScopedReset`. */
export const useDashboardAuthReset = useAuthScopedReset;
