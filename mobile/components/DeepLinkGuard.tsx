import * as Linking from "expo-linking";
import { type Href, useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "../context/AuthContext";
import { deepLinkRequiresAuth, isAllowedDeepLinkPath, toRoutableHref } from "../lib/deepLinkGuard";

export function DeepLinkGuard() {
  const router = useRouter();
  const { token } = useAuth();

  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      const parsed = Linking.parse(url);
      const targetPath = typeof parsed.path === "string" ? parsed.path : "";

      if (!isAllowedDeepLinkPath(targetPath)) {
        router.replace((token ? "/dashboard" : "/(auth)/login") as Href);
        return;
      }

      if (deepLinkRequiresAuth(targetPath) && !token) {
        router.replace("/(auth)/login");
        return;
      }

      router.push(toRoutableHref(targetPath) as Href);
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    return () => sub.remove();
  }, [router, token]);

  return null;
}
