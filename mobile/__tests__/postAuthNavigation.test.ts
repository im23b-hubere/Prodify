import AsyncStorage from "@react-native-async-storage/async-storage";

import { ONBOARDING_COMPLETE_KEY } from "../constants/storageKeys";
import { getPostLoginHref, POST_REGISTER_HREF } from "../lib/postAuthNavigation";

describe("postAuthNavigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exports a fixed post-register route", () => {
    expect(POST_REGISTER_HREF).toBe("/onboarding");
  });

  it("getPostLoginHref returns dashboard when onboarding flag is set", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("1");
    await expect(getPostLoginHref()).resolves.toBe("/(tabs)/dashboard");
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(ONBOARDING_COMPLETE_KEY);
  });

  it("getPostLoginHref returns onboarding when flag is missing or not 1", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await expect(getPostLoginHref()).resolves.toBe("/onboarding");

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("0");
    await expect(getPostLoginHref()).resolves.toBe("/onboarding");
  });

  it("getPostLoginHref returns onboarding when AsyncStorage throws", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error("storage"));
    await expect(getPostLoginHref()).resolves.toBe("/onboarding");
  });
});
