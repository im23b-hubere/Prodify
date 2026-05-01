import NetInfo from "@react-native-community/netinfo";
import { apiJson, apiMultipart } from "../../lib/client";

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

  it("does not retry POST by default on network errors", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new TypeError("network down"));

    await expect(
      apiJson("/auth/login", { method: "POST", body: { email: "a", password: "b" }, retries: 2 }),
    ).rejects.toBeInstanceOf(Error);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries POST when retryUnsafeMethods explicitly allows it", async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      });

    await expect(
      apiJson("/auth/login", {
        method: "POST",
        body: { email: "a", password: "b" },
        retries: 2,
        retryUnsafeMethods: ["POST"],
      }),
    ).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 401 even when POST retries are enabled", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: "Unauthorized" }),
    });

    await expect(
      apiJson("/auth/login", {
        method: "POST",
        body: { email: "a", password: "b" },
        retries: 2,
        retryUnsafeMethods: ["POST"],
      }),
    ).rejects.toMatchObject({ name: "ApiError", status: 401 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 422 even when POST retries are enabled", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ detail: "Validation failed" }),
    });

    await expect(
      apiJson("/auth/register", {
        method: "POST",
        body: { email: "a", username: "u", password: "b" },
        retries: 2,
        retryUnsafeMethods: ["POST"],
      }),
    ).rejects.toMatchObject({ name: "ApiError", status: 422 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries enabled POST on retryable status codes", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ detail: "Upstream unavailable" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      });

    await expect(
      apiJson("/auth/login", {
        method: "POST",
        body: { email: "a", password: "b" },
        retries: 2,
        retryUnsafeMethods: ["POST"],
      }),
    ).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("apiMultipart", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps abort timeout to a user-facing timeout error", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    (global.fetch as jest.Mock).mockRejectedValue(abortError);

    await expect(
      apiMultipart("/users/me/profile-picture", {
        method: "POST",
        token: "token",
        formData: new FormData(),
      }),
    ).rejects.toThrow();
  });

  it("returns explicit caller abort reason", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    (global.fetch as jest.Mock).mockRejectedValue(abortError);
    const controller = new AbortController();
    controller.abort();

    await expect(
      apiMultipart("/users/me/profile-picture", {
        method: "POST",
        token: "token",
        formData: new FormData(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError", message: "Request aborted by caller" });
  });
});
