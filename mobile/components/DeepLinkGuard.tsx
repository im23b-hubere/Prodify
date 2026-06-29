import * as Linking from "expo-linking";
import { type Href, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { useAuth } from "../context/AuthContext";
import {
  deepLinkRequiresAuth,
  extractDeepLinkPath,
  isAllowedDeepLinkPath,
  toRoutableHref,
} from "../lib/deepLinkGuard";
import {
  readOnboardingComplete,
  resolveDeepLinkFallbackHref,
  resolveUnauthenticatedAuthHref,
  toHref,
} from "../lib/postAuthNavigation";
import { setPendingDeepLinkPath } from "../lib/pendingDeepLink";

export function DeepLinkGuard() {
  const router = useRouter();
  const { token } = useAuth();
  const initialUrlHandled = useRef(false);

  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      const parsed = Linking.parse(url);
      const fromParsed = typeof parsed.path === "string" ? parsed.path : "";
      const targetPath = extractDeepLinkPath(url) || fromParsed;

      if (!isAllowedDeepLinkPath(targetPath)) {
        void readOnboardingComplete().then((onboardingComplete) => {
          router.replace(
            toHref({
              pathname: resolveDeepLinkFallbackHref(Boolean(token), onboardingComplete),
            }) as Href,
          );
        });
        return;
      }

      if (deepLinkRequiresAuth(targetPath) && !token) {
        void setPendingDeepLinkPath(targetPath);
        void readOnboardingComplete().then((onboardingComplete) => {
          router.replace(
            toHref({ pathname: resolveUnauthenticatedAuthHref(onboardingComplete) }) as Href,
          );
        });
        return;
      }

      router.push(toRoutableHref(targetPath) as Href);
    };

    if (!initialUrlHandled.current) {
      initialUrlHandled.current = true;
      void Linking.getInitialURL()
        .then((initialUrl) => {
          if (typeof initialUrl === "string" && initialUrl.trim()) {
            handleDeepLink({ url: initialUrl });
          }
        })
        .catch(() => undefined);
    }

    const sub = Linking.addEventListener("url", handleDeepLink);
    return () => sub.remove();
  }, [router, token]);

  return null;
}
