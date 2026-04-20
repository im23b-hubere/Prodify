import {
  deepLinkRequiresAuth,
  isAllowedDeepLinkPath,
  normalizeIncomingPath,
  toRoutableHref,
} from "../lib/deepLinkGuard";

describe("deepLinkGuard", () => {
  it("normalizes incoming paths safely", () => {
    expect(normalizeIncomingPath("/session/123/")).toBe("session/123");
    expect(normalizeIncomingPath("///dashboard")).toBe("dashboard");
    expect(normalizeIncomingPath(undefined)).toBe("");
  });

  it("allows only whitelisted deep-link paths", () => {
    expect(isAllowedDeepLinkPath("session/42")).toBe(true);
    expect(isAllowedDeepLinkPath("dashboard")).toBe(true);
    expect(isAllowedDeepLinkPath("admin/root-shell")).toBe(false);
  });

  it("requires auth for protected routes and builds safe hrefs", () => {
    expect(deepLinkRequiresAuth("login")).toBe(false);
    expect(deepLinkRequiresAuth("session/42")).toBe(true);
    expect(toRoutableHref("session/42")).toBe("/session/42");
    expect(toRoutableHref("")).toBe("/");
  });
});
