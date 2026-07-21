import AsyncStorage from "@react-native-async-storage/async-storage";

import { ENTITLEMENT_PERSISTENCE_KEY } from "../../constants/storageKeys";
import {
  isPersistedPremiumValid,
  loadPersistedEntitlement,
  persistEntitlement,
} from "../../lib/entitlementStorage";
import type { EntitlementDto } from "../../types/outcomes";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const premiumEnt: EntitlementDto = {
  provider: "revenuecat",
  entitlement: "premium",
  trial_active: false,
  expires_at: "2099-01-01T00:00:00.000Z",
};

describe("entitlementStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("treats premium without expiry as valid", () => {
    expect(
      isPersistedPremiumValid({
        provider: "revenuecat",
        entitlement: "premium",
        trial_active: false,
        expires_at: null,
      }),
    ).toBe(true);
  });

  it("loads persisted premium for the matching user", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ userId: 7, value: premiumEnt, cachedAtMs: Date.now() }),
    );

    await expect(loadPersistedEntitlement(7)).resolves.toEqual(premiumEnt);
  });

  it("persists premium snapshots per user", async () => {
    await persistEntitlement(9, premiumEnt);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `${ENTITLEMENT_PERSISTENCE_KEY}_9`,
      expect.stringContaining('"entitlement":"premium"'),
    );
  });
});
