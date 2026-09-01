import { fireEvent, render, screen } from "@testing-library/react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { PaywallContent } from "../../../features/paywall/components/PaywallContent";
import type { PaywallController } from "../../../features/paywall/usePaywallController";

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useSharedValue = (value: number) => ({ value });
  Reanimated.withRepeat = (value: unknown) => value;
  Reanimated.withTiming = (value: unknown) => value;
  return Reanimated;
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { price?: string }) =>
      options?.price ? `${key}:${options.price}` : key,
  }),
}));

function purchasesPackage(priceString: string): PurchasesPackage {
  return { product: { priceString } } as PurchasesPackage;
}

function controller(overrides: Partial<PaywallController> = {}): PaywallController {
  return {
    copy: { title: "Go Pro", body: "Unlock everything" },
    loading: false,
    busy: false,
    weeklyPkg: purchasesPackage("CHF 4.90"),
    sixMonthPkg: purchasesPackage("CHF 49.00"),
    error: null,
    purchaseEnabled: true,
    expoGoPreviewMode: false,
    previewWeeklyPrice: "weekly preview",
    previewSixMonthPrice: "six month preview",
    retry: jest.fn(),
    purchasePackage: jest.fn().mockResolvedValue(undefined),
    onRestore: jest.fn().mockResolvedValue(undefined),
    onSkipSubscriptionForDev: jest.fn().mockResolvedValue(undefined),
    confirmLogout: jest.fn(),
    confirmDeleteAccount: jest.fn(),
    ...overrides,
  };
}

function renderPaywall(detail: PaywallController, signedIn = true) {
  const onOpenPrivacy = jest.fn();
  const onOpenTerms = jest.fn();
  render(
    <PaywallContent
      controller={detail}
      signedIn={signedIn}
      onOpenPrivacy={onOpenPrivacy}
      onOpenTerms={onOpenTerms}
    />,
  );
  return { onOpenPrivacy, onOpenTerms };
}

describe("PaywallContent", () => {
  it("purchases the selected plan from a single continue action", () => {
    const detail = controller();
    const navigation = renderPaywall(detail);

    fireEvent.press(screen.getByText("paywall.cta.continue"));
    fireEvent.press(screen.getByText("paywall.cta.weekly"));
    fireEvent.press(screen.getByText("paywall.cta.continue"));
    fireEvent.press(screen.getByLabelText("paywall.cta.restore"));
    fireEvent.press(screen.getByLabelText("paywall.legal.privacyLink"));
    fireEvent.press(screen.getByLabelText("paywall.legal.termsLink"));
    fireEvent.press(screen.getByLabelText("paywall.account.signOut"));
    fireEvent.press(screen.getByLabelText("paywall.account.deleteAccount"));

    expect(detail.purchasePackage).toHaveBeenNthCalledWith(1, detail.sixMonthPkg);
    expect(detail.purchasePackage).toHaveBeenNthCalledWith(2, detail.weeklyPkg);
    expect(detail.onRestore).toHaveBeenCalledTimes(1);
    expect(navigation.onOpenPrivacy).toHaveBeenCalledTimes(1);
    expect(navigation.onOpenTerms).toHaveBeenCalledTimes(1);
    expect(detail.confirmLogout).toHaveBeenCalledTimes(1);
    expect(detail.confirmDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("shows offering errors with a retry instead of plan buttons", () => {
    const detail = controller({ error: "Apple unavailable", purchaseEnabled: false });
    renderPaywall(detail, false);

    expect(screen.getByText("Apple unavailable")).toBeTruthy();
    expect(screen.queryByText("paywall.cta.weekly")).toBeNull();
    expect(screen.queryByText("paywall.cta.continue")).toBeNull();
    fireEvent.press(screen.getByText("common.tryAgain"));
    expect(detail.retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("paywall.account.signOut")).toBeNull();
  });

  it("uses preview prices and exposes only the development skip", () => {
    const detail = controller({
      expoGoPreviewMode: true,
      weeklyPkg: null,
      sixMonthPkg: null,
      purchaseEnabled: false,
    });
    renderPaywall(detail);

    expect(screen.getByText("paywall.cta.bestValue")).toBeTruthy();
    expect(screen.getByText("paywall.cta.weekly")).toBeTruthy();
    expect(screen.getByText("weekly preview")).toBeTruthy();
    expect(screen.getByText("paywall.cta.sixMonth")).toBeTruthy();
    expect(screen.getByText("six month preview")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("paywall.cta.restore"));
    fireEvent.press(screen.getByLabelText("paywall.a11y.skipSubscription"));
    expect(detail.onRestore).not.toHaveBeenCalled();
    expect(detail.onSkipSubscriptionForDev).toHaveBeenCalledTimes(1);
  });
});
