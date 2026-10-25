import { act, renderHook } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";

import { useProfilePictureUpload } from "../../../features/profile/hooks/useProfilePictureUpload";
import { uploadProfilePicture } from "../../../lib/profilePictureUpload";

jest.mock("../../../lib/profilePictureUpload", () => ({
  uploadProfilePicture: jest.fn(),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const CHOSEN_PHOTO = { uri: "file:///picked.jpg", mimeType: "image/jpeg", fileName: null };
const UPDATED_PROFILE = { id: 7, email: "a@example.com", username: "artist" };

function renderUpload(applyAuthenticatedUser = jest.fn()) {
  return renderHook(() => useProfilePictureUpload({ token: "token", applyAuthenticatedUser }));
}

describe("useProfilePictureUpload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [CHOSEN_PHOTO],
    } as never);
    jest.mocked(uploadProfilePicture).mockResolvedValue(UPDATED_PROFILE);
  });

  it("opens the system photo picker without asking for access to the whole library", async () => {
    const { result } = renderUpload();

    await act(async () => {
      await result.current.pickAndUpload();
    });

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it("uploads the chosen photo and shows the updated profile", async () => {
    const applyAuthenticatedUser = jest.fn();
    const { result } = renderUpload(applyAuthenticatedUser);

    await act(async () => {
      await result.current.pickAndUpload();
    });

    expect(uploadProfilePicture).toHaveBeenCalledWith("token", CHOSEN_PHOTO);
    expect(applyAuthenticatedUser).toHaveBeenCalledWith(UPDATED_PROFILE);
  });
});
