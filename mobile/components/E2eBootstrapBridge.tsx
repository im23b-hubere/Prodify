import { extractDeepLinkPath } from "../lib/deepLinkGuard";
import { isE2eModeEnabled } from "../lib/e2eMode";

const BOOTSTRAP_PATH = "e2e/bootstrap";

function isBootstrapUrl(url: string): boolean {
  return extractDeepLinkPath(url) === BOOTSTRAP_PATH;
}

export function isE2eBootstrapDeepLink(url: string): boolean {
  return isE2eModeEnabled() && isBootstrapUrl(url);
}
