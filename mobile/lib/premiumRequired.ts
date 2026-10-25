import { ApiError } from "./apiErrors";

/** Sent only by the server's subscriber gate; other 402 responses are product limits. */
export const PREMIUM_REQUIRED_CODE = "PREMIUM_REQUIRED";

export type PremiumRequiredRejection = {
  token: string;
  /** A grant cached after this moment is newer than the rejection and must survive it. */
  requestStartedAtMs: number;
};

type RejectedRequest = PremiumRequiredRejection & { path: string; method: string };

let premiumRequiredHandler: ((rejection: PremiumRequiredRejection) => void | Promise<void>) | null =
  null;

export function setApiPremiumRequiredHandler(
  handler: ((rejection: PremiumRequiredRejection) => void | Promise<void>) | null,
): void {
  premiumRequiredHandler = handler;
}

export function isPremiumRequiredError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 402 && error.code === PREMIUM_REQUIRED_CODE;
}

/** Hand a subscriber-gate rejection to the app so it can end local access once. */
export function reportPremiumRequired(request: RejectedRequest, error: ApiError): void {
  if (!premiumRequiredHandler || !request.token || !isPremiumRequiredError(error)) return;
  if (isReachableWithoutSubscription(request.path, request.method)) return;
  const { token, requestStartedAtMs } = request;
  void Promise.resolve(premiumRequiredHandler({ token, requestStartedAtMs })).catch(
    () => undefined,
  );
}

/** Billing and account deletion are how an unpaid account subscribes or leaves. */
function isReachableWithoutSubscription(path: string, method: string): boolean {
  const route = path.split("?")[0];
  if (route === "/billing" || route.startsWith("/billing/")) return true;
  return route === "/users/me" && method.toUpperCase() === "DELETE";
}
