import {
  deepLinkRequiresAuth,
  extractDeepLinkPath,
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

  it("extracts path from prodify:// host-style and host/path URLs", () => {
    expect(extractDeepLinkPath("prodify://dashboard")).toBe("dashboard");
    expect(extractDeepLinkPath("prodify://session/42")).toBe("session/42");
    expect(extractDeepLinkPath("prodify:///dashboard")).toBe("dashboard");
    expect(extractDeepLinkPath("https://example.com/stats")).toBe("stats");
  });

  it("allows only whitelisted deep-link paths", () => {
    expect(isAllowedDeepLinkPath("session/42")).toBe(true);
    expect(isAllowedDeepLinkPath("dashboard")).toBe(true);
    expect(isAllowedDeepLinkPath("session-trash")).toBe(true);
    expect(isAllowedDeepLinkPath("progression-overview")).toBe(true);
    expect(isAllowedDeepLinkPath("session/history")).toBe(true);
    expect(isAllowedDeepLinkPath("admin/root-shell")).toBe(false);
  });

  it("requires auth for protected routes and builds safe hrefs", () => {
    expect(deepLinkRequiresAuth("login")).toBe(false);
    expect(deepLinkRequiresAuth("session/42")).toBe(true);
    expect(toRoutableHref("session/42")).toBe("/session/42");
    expect(toRoutableHref("session/history")).toBe("/session/history");
    expect(toRoutableHref("session/active")).toBe("/session-active");
    expect(toRoutableHref("dashboard")).toBe("/(tabs)/dashboard");
    expect(toRoutableHref("")).toBe("/");
  });

  it("allows challenge deep links", () => {
    expect(isAllowedDeepLinkPath("challenge/12")).toBe(true);
    expect(toRoutableHref("challenge/12")).toBe("/challenge/12");
  });
});
