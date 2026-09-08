import * as Linking from "expo-linking";
import { type Href, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { useAuth } from "../context/AuthContext";
import {
  deepLinkRequiresAuth,
  extractDeepLinkPath,
  isAllowedDeepLinkPath,
  isExpoDevClientLaunchUrl,
  toRoutableHref,
} from "../lib/deepLinkGuard";
import { isE2eBootstrapDeepLink, parseE2eBootstrapDeepLink } from "../lib/e2eBootstrapDeepLink";
import {
  readOnboardingComplete,
  resolveDeepLinkFallbackHref,
  resolveUnauthenticatedAuthHref,
  toHref,
} from "../lib/postAuthNavigation";
import { setPendingDeepLinkPath } from "../lib/pendingDeepLink";

export function DeepLinkGuard() {
  const router = useRouter();
  const { token, hydrated } = useAuth();
  const initialUrlHandled = useRef(false);

  useEffect(() => {
    // Before hydration `token` is always null, so acting here would bounce a
    // signed-in user to login and strand the link in pending storage.
    if (!hydrated) return;

    const handleDeepLink = ({ url }: { url: string }) => {
      if (isExpoDevClientLaunchUrl(url)) return;
      if (isE2eBootstrapDeepLink(url)) {
        const creds = parseE2eBootstrapDeepLink(url);
        if (creds) {
          router.replace({
            pathname: "/e2e/bootstrap",
            params: { email: creds.email, password: creds.password },
          } as Href);
        }
        return;
      }

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
  }, [hydrated, router, token]);

  return null;
}
