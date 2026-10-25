import AsyncStorage from "@react-native-async-storage/async-storage";

import { SESSION_USER_ID_KEY } from "../../constants/storageKeys";
import {
  forgetSessionUserId,
  readSessionUserId,
  rememberSessionUserId,
} from "../../lib/sessionUserStorage";

describe("sessionUserStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("remembers who was signed in for the next launch", async () => {
    await rememberSessionUserId(7);

    await expect(readSessionUserId()).resolves.toBe(7);
  });

  it("forgets the account once the session ends", async () => {
    await rememberSessionUserId(7);

    await forgetSessionUserId();

    await expect(readSessionUserId()).resolves.toBeNull();
  });

  it("ignores a stored value that is not an account id", async () => {
    await AsyncStorage.setItem(SESSION_USER_ID_KEY, "not-a-number");

    await expect(readSessionUserId()).resolves.toBeNull();
  });
});
