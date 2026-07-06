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
  const { token } = useAuth();
  const initialUrlHandled = useRef(false);

  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
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
  }, [router, token]);

  return null;
}
