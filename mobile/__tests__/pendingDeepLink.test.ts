import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearPendingDeepLinkPath,
  consumePendingDeepLinkHref,
  setPendingDeepLinkPath,
} from "../lib/pendingDeepLink";

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe("pendingDeepLink", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores allowed auth-required paths", async () => {
    await setPendingDeepLinkPath("session/7");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "prodify_pending_deep_link_path_v1",
      "session/7",
    );
  });

  it("does not store public routes", async () => {
    await setPendingDeepLinkPath("login");
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("consumes and validates stored path", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("session/7");
    const href = await consumePendingDeepLinkHref();
    expect(href).toBe("/session/7");
    expect(AsyncStorage.removeItem).toHaveBeenCalled();
  });

  it("clears invalid stored paths on consume", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("admin/hack");
    const href = await consumePendingDeepLinkHref();
    expect(href).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalled();
  });

  it("clearPendingDeepLinkPath removes key", async () => {
    await clearPendingDeepLinkPath();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("prodify_pending_deep_link_path_v1");
  });
});
