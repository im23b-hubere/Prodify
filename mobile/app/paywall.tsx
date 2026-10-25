import { openLegalPage } from "../constants/legal";
import { PaywallContent } from "../features/paywall/components/PaywallContent";
import { usePaywallController } from "../features/paywall/usePaywallController";

export default function PaywallScreen() {
  const controller = usePaywallController();

  return (
    <PaywallContent
      controller={controller}
      onOpenPrivacy={() => openLegalPage("privacy")}
      onOpenTerms={() => openLegalPage("terms")}
    />
  );
}
