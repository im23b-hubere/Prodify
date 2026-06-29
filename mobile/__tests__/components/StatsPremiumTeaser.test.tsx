import { fireEvent, render, screen } from "@testing-library/react-native";

import { StatsPremiumTeaser } from "../../components/stats/StatsPremiumTeaser";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

describe("StatsPremiumTeaser", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders teaser copy and opens paywall on press", () => {
    render(<StatsPremiumTeaser testID="stats-premium-teaser" />);

    expect(screen.getByTestId("stats-premium-teaser")).toBeTruthy();
    expect(screen.getByText("stats.premiumForecastTeaserTitle")).toBeTruthy();
    fireEvent.press(screen.getByText("stats.premiumForecastCta"));
    expect(mockPush).toHaveBeenCalledWith("/paywall");
  });
});
