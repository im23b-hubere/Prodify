import { authenticate } from "../../lib/authSessionService";
import { apiJson } from "../../lib/client";

jest.mock("../../lib/client", () => ({ apiJson: jest.fn() }));
jest.mock("../../lib/revenuecat", () => ({
  activeEntitlementExpiration: jest.fn(),
  configureRevenueCat: jest.fn(),
  getRevenueCatCustomerInfo: jest.fn(),
  isPremiumActive: jest.fn(),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

describe("auth session service", () => {
  beforeEach(() => jest.clearAllMocks());

  it("normalizes tokens and verifies the identity before returning", async () => {
    mockApiJson
      .mockResolvedValueOnce({ access_token: " access ", refresh_token: " refresh " })
      .mockResolvedValueOnce({ id: 7, email: "a@example.com", username: "artist" });

    const result = await authenticate({
      path: "/auth/login",
      body: { email: "a@example.com", password: "secret" },
      timeoutMs: 90_000,
      identityTimeoutMs: 30_000,
      retries: 0,
      unexpectedResponseMessage: "Unexpected response",
    });

    expect(result.pair).toEqual({ access_token: "access", refresh_token: "refresh" });
    expect(mockApiJson).toHaveBeenNthCalledWith(2, "/auth/me", {
      token: "access",
      timeoutMs: 30_000,
    });
    expect(result.user.username).toBe("artist");
  });

  it("rejects incomplete token responses before requesting identity", async () => {
    mockApiJson.mockResolvedValueOnce({ access_token: "access" });

    await expect(
      authenticate({
        path: "/auth/register",
        body: { email: "a@example.com", username: "artist", password: "secret" },
        timeoutMs: 90_000,
        identityTimeoutMs: 30_000,
        retries: 0,
        unexpectedResponseMessage: "Unexpected response",
      }),
    ).rejects.toThrow("Unexpected response");
    expect(mockApiJson).toHaveBeenCalledTimes(1);
  });
});
