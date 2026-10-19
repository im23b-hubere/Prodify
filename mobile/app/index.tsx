import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "../constants/theme";

import { useAuth } from "../context/AuthContext";
import { getLaunchPhase, setLaunchPhase } from "../lib/launch";
import { readOnboardingComplete, resolvePostAuthRoute, toHref } from "../lib/postAuthNavigation";

/** The logo stays at least this long, so the launch reads as a beat, not a flash. */
const MIN_SPLASH_MS = 1300;
/** Time for the first screen to draw underneath before the logo zooms away. */
const SETTLE_MS = 260;

/**
 * The start route. The logo layer (LaunchOverlay in the root layout) covers it; this
 * decides where the launch lands, opens that screen underneath and starts the reveal.
 */
export default function Index() {
  const router = useRouter();
  const { token, hydrated } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
    readOnboardingComplete()
      .then((done) => setOnboarded(done))
      .catch(() => setOnboarded(false));
  }, []);

  useEffect(() => {
    if (!hydrated || onboarded === null) return;

    const route = resolvePostAuthRoute({
      hasToken: Boolean(token),
      onboardingComplete: onboarded,
      entryPoint: "app_launch",
      allowPaywallPrompt: false,
    });
    // Later visits to "/" (e2e bootstrap, dev redirects) have no logo to hold.
    if (getLaunchPhase() !== "splash") {
      router.replace(toHref(route));
      return;
    }
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - startedAt.current));
    const open = setTimeout(() => {
      router.replace(toHref(route));
      // Not tied to this screen: the replace may unmount it before the reveal starts.
      setTimeout(() => setLaunchPhase("revealing"), SETTLE_MS);
    }, wait);
    return () => clearTimeout(open);
    // Decide once: later token changes are handled by the screens themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, onboarded]);

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
