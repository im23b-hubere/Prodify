jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  },
}));

jest.mock("../../constants/api", () => ({
  API_BASE_URL: "http://test.local",
  getAppEnvironment: () => "development",
}));

import NetInfo from "@react-native-community/netinfo";
import { apiJson, ApiError } from "../../lib/client";

describe("apiJson error parsing", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses error.message from backend JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: "Invalid credentials" } }),
    });

    await expect(apiJson("/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Invalid credentials",
    });
  });

  it("falls back to FastAPI detail string", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ detail: "Not found" }),
    });

    await expect(apiJson("/users/999", {})).rejects.toThrow("Not found");
  });

  it("parses validation-style error.message with code", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () =>
        JSON.stringify({
          error: {
            message: "Validation failed",
            code: "VALIDATION_ERROR",
          },
        }),
    });

    await expect(apiJson("/sessions/start", { method: "POST", body: {} })).rejects.toThrow(
      "Validation failed",
    );
  });

  it("still performs request when LAN reports isInternetReachable false", async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
      isConnected: true,
      isInternetReachable: false,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => "",
    });

    await expect(apiJson("/users/me", { method: "DELETE", token: "t" })).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalled();
  });
});
