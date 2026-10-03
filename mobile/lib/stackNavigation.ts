import type { Href } from "expo-router";

export type ReturnRouter = {
  back: () => void;
  canGoBack: () => boolean;
  dismissTo: (href: Href) => void;
  canDismiss?: () => boolean;
  dismiss?: () => void;
};

type ReturnOptions = {
  /** A presented modal should drop away, not pop like a card in the stack. */
  modal?: boolean;
};

/**
 * Leave the current screen for one that is already mounted.
 * A modal dismisses. A card pops. A deep link with no history pops to `href`.
 */
export function returnTo(router: ReturnRouter, href: Href, options?: ReturnOptions): void {
  if (options?.modal && router.canDismiss?.() && router.dismiss) {
    router.dismiss();
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.dismissTo(href);
}

/** Switch a tab that is already mounted. Does not push a second copy of the tab bar. */
export function openTab(router: { navigate: (href: Href) => void }, href: Href): void {
  router.navigate(href);
}

/** Close every screen above a tab and show that tab. */
export function dismissToTab(router: { dismissTo: (href: Href) => void }, href: Href): void {
  router.dismissTo(href);
}

export function sessionSummaryHref(sessionId: number): Href {
  return { pathname: "/session/complete", params: { id: String(sessionId) } };
}
