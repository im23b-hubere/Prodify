import AsyncStorage from "@react-native-async-storage/async-storage";
import type { useRouter } from "expo-router";

import { ONBOARDING_COMPLETE_KEY } from "../../constants/storageKeys";
import { replaceWithPendingDeepLinkOrDashboard } from "../../lib/pendingDeepLink";
import { resolvePostAuthRouteFromStorage, toHref } from "../../lib/postAuthNavigation";

type Router = Pick<ReturnType<typeof useRouter>, "replace">;

/** Someone signing into an account they already have skips the first-run onboarding. */
export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1").catch(() => undefined);
}

export async function navigateAfterSignIn(router: Router): Promise<void> {
  const route = await resolvePostAuthRouteFromStorage({ hasToken: true, entryPoint: "login" });
  if (route.pathname === "/(tabs)/dashboard") {
    await replaceWithPendingDeepLinkOrDashboard(router);
    return;
  }
  router.replace(toHref(route));
}
