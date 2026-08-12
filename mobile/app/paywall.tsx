import { useRouter } from "expo-router";

import { useAuth } from "../context/AuthContext";
import { PaywallContent } from "../features/paywall/components/PaywallContent";
import { usePaywallController } from "../features/paywall/usePaywallController";

export default function PaywallScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const controller = usePaywallController();

  return (
    <PaywallContent
      controller={controller}
      signedIn={Boolean(token)}
      onOpenPrivacy={() => router.push("/legal/privacy" as never)}
      onOpenTerms={() => router.push("/legal/terms" as never)}
    />
  );
}
