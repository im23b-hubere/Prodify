import { refreshAccessToken, setAuthRefreshBridge, type TokenPair } from "../../lib/apiAuthRefresh";

describe("API auth refresh coordinator", () => {
  afterEach(() => {
    setAuthRefreshBridge(null, null);
  });

  it("deduplicates concurrent refresh requests", async () => {
    const pair = { access_token: " access ", refresh_token: " rotated " };
    const apply = jest.fn().mockResolvedValue(undefined);
    const request = jest.fn().mockResolvedValue(pair);
    setAuthRefreshBridge(jest.fn().mockResolvedValue(" refresh "), apply);

    const [first, second] = await Promise.all([
      refreshAccessToken(request),
      refreshAccessToken(request),
    ]);

    const normalized: TokenPair = { access_token: "access", refresh_token: "rotated" };
    expect(first).toEqual(normalized);
    expect(second).toEqual(normalized);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("refresh");
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(normalized);
  });

  it("does not call the API when no refresh token is stored", async () => {
    const request = jest.fn();
    setAuthRefreshBridge(jest.fn().mockResolvedValue(null), jest.fn());

    await expect(refreshAccessToken(request)).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects incomplete token pairs without applying them", async () => {
    const apply = jest.fn();
    setAuthRefreshBridge(jest.fn().mockResolvedValue("refresh"), apply);

    await expect(
      refreshAccessToken(jest.fn().mockResolvedValue({ access_token: "", refresh_token: "next" })),
    ).resolves.toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
});
