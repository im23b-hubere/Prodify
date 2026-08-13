import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";

import { debugNav } from "../../lib/debugLog";
import {
  deepLinkRequiresAuth,
  isAllowedDeepLinkPath,
  toRoutableHref,
} from "../../lib/deepLinkGuard";

export function useNotificationNavigation(token?: string | null) {
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string }>();

  const goBack = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(params.source === "profile" ? "/(tabs)/profile" : "/(tabs)/dashboard");
  }, [params.source, router]);

  const openAction = useCallback(
    (rawPath: string) => {
      if (!isAllowedDeepLinkPath(rawPath)) {
        debugNav("inbox_action_route_blocked", { path: rawPath });
        return;
      }
      if (deepLinkRequiresAuth(rawPath) && !token) {
        router.replace("/(auth)/login");
        return;
      }
      router.push(toRoutableHref(rawPath) as Href);
    },
    [router, token],
  );

  return { goBack, openAction };
}
