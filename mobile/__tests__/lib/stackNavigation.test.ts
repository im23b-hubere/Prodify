import {
  dismissToTab,
  openTab,
  returnTo,
  sessionSummaryHref,
} from "../../lib/stackNavigation";

function routerDouble(options: { canGoBack?: boolean; canDismiss?: boolean } = {}) {
  return {
    back: jest.fn(),
    canGoBack: () => options.canGoBack ?? false,
    dismiss: jest.fn(),
    canDismiss: () => options.canDismiss ?? false,
    dismissTo: jest.fn(),
    navigate: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  };
}

describe("returnTo", () => {
  it("dismisses a presented modal instead of pushing a new screen", () => {
    const router = routerDouble({ canDismiss: true, canGoBack: true });

    returnTo(router, "/(tabs)/dashboard", { modal: true });

    expect(router.dismiss).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("pops a card when a screen is already underneath", () => {
    const router = routerDouble({ canDismiss: true, canGoBack: true });

    returnTo(router, "/(tabs)/dashboard");

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.dismiss).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it("pops to the fallback tab when the screen was opened with no history", () => {
    const router = routerDouble({ canGoBack: false, canDismiss: false });

    returnTo(router, "/(tabs)/stats");

    expect(router.dismissTo).toHaveBeenCalledWith("/(tabs)/stats");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("openTab", () => {
  it("switches the tab that is already mounted", () => {
    const router = routerDouble();

    openTab(router, "/(tabs)/stats");

    expect(router.navigate).toHaveBeenCalledWith("/(tabs)/stats");
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("dismissToTab", () => {
  it("closes the screens above that tab", () => {
    const router = routerDouble();

    dismissToTab(router, "/(tabs)/friends");

    expect(router.dismissTo).toHaveBeenCalledWith("/(tabs)/friends");
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("sessionSummaryHref", () => {
  it("targets the completion screen for that session", () => {
    expect(sessionSummaryHref(12)).toEqual({
      pathname: "/session/complete",
      params: { id: "12" },
    });
  });
});
