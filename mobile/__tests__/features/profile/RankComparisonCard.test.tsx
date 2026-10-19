import { fireEvent, render, screen } from "@testing-library/react-native";

import { RankComparisonCard } from "../../../features/profile/components/RankComparisonCard";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { SvgXml: () => React.createElement(View) };
});

jest.mock("../../../lib/rankArt.generated", () => ({
  RANK_ART_XML: { 1: "<svg />", 5: "<svg />", 8: "<svg />" },
}));

describe("RankComparisonCard", () => {
  it("shows both ranks and opens the path", () => {
    const onOpenPath = jest.fn();
    render(
      <RankComparisonCard
        you={{ level: 5, label: "Lv 5" }}
        them={{ level: 8, label: "Lv 8" }}
        friendName="nova"
        onOpenPath={onOpenPath}
      />,
    );
    expect(screen.getByTestId("friend-profile-rank-comparison")).toBeTruthy();
    expect(screen.getByText("Lv 5")).toBeTruthy();
    expect(screen.getByText("Lv 8")).toBeTruthy();
    expect(
      screen.getByText(/friendProfile.rankCompareVerdict.them:.*"name":"nova"/),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId("friend-profile-rank-path-cta"));
    expect(onOpenPath).toHaveBeenCalledTimes(1);
  });
});
