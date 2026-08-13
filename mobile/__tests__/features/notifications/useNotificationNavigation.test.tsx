import { act, renderHook } from "@testing-library/react-native";

import { useNotificationNavigation } from "../../../features/notifications/useNotificationNavigation";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
let mockSource: string | undefined;

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ source: mockSource }),
  useRouter: () => ({
    back: mockBack,
    canGoBack: () => mockCanGoBack,
    push: mockPush,
    replace: mockReplace,
  }),
}));

describe("useNotificationNavigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = false;
    mockSource = undefined;
  });

  it("uses a stable dashboard fallback when no history exists", () => {
    const { result } = renderHook(() => useNotificationNavigation("token"));
    act(() => result.current.goBack());
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
  });

  it("returns to profile for notifications opened there", () => {
    mockSource = "profile";
    const { result } = renderHook(() => useNotificationNavigation("token"));
    act(() => result.current.goBack());
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/profile");
  });

  it("blocks untrusted action routes", () => {
    const { result } = renderHook(() => useNotificationNavigation("token"));
    act(() => result.current.openAction("https://malicious.example"));
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("requires authentication before opening protected routes", () => {
    const { result } = renderHook(() => useNotificationNavigation(null));
    act(() => result.current.openAction("/(tabs)/dashboard"));
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
    expect(mockPush).not.toHaveBeenCalled();
  });
});
