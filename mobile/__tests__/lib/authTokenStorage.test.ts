import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { REFRESH_TOKEN_KEY } from "../../constants/storageKeys";
import {
  ACCESS_TOKEN_KEY,
  clearTokenPair,
  readAccessToken,
  readRefreshToken,
  writeTokenPair,
} from "../../lib/authTokenStorage";
import * as e2eMode from "../../lib/e2eMode";

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("../../lib/e2eMode", () => ({
  isE2eModeEnabled: jest.fn(),
}));

describe("authTokenStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("uses AsyncStorage in E2E mode", async () => {
    jest.spyOn(e2eMode, "isE2eModeEnabled").mockReturnValue(true);

    await writeTokenPair("access", "refresh");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ACCESS_TOKEN_KEY, "access");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, "refresh");
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("uses SecureStore outside E2E mode", async () => {
    jest.spyOn(e2eMode, "isE2eModeEnabled").mockReturnValue(false);

    await writeTokenPair("access", "refresh");

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(ACCESS_TOKEN_KEY, "access");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, "refresh");
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("reads and clears tokens from AsyncStorage in E2E mode", async () => {
    jest.spyOn(e2eMode, "isE2eModeEnabled").mockReturnValue(true);
    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce(" access ")
      .mockResolvedValueOnce(" refresh ");

    await expect(readAccessToken()).resolves.toBe("access");
    await expect(readRefreshToken()).resolves.toBe("refresh");

    await clearTokenPair();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
  });
});
