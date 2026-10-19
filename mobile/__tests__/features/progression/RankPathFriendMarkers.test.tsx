import { fireEvent, render, screen } from "@testing-library/react-native";

import { RankPathFriendMarkers } from "../../../features/progression/components/RankPathFriendMarkers";
import { clusterFriendsByLevel } from "../../../features/progression/clusterFriendsByLevel";
import { buildRankPathLayout } from "../../../features/progression/rankPathLayout";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Image: (props: object) => React.createElement(View, props) };
});

describe("RankPathFriendMarkers", () => {
  const layout = buildRankPathLayout(390);

  it("renders nothing when there are no friend clusters", () => {
    render(
      <RankPathFriendMarkers
        layout={layout}
        clusters={[]}
        onOpenFriend={jest.fn()}
        onOpenCluster={jest.fn()}
      />,
    );
    expect(screen.queryByTestId("rank-path-friend-markers")).toBeNull();
  });

  it("opens a friend profile from a single marker", () => {
    const onOpenFriend = jest.fn();
    const clusters = clusterFriendsByLevel([
      { user_id: 9, username: "nova", level: 4, profile_picture_url: null },
    ]);
    render(
      <RankPathFriendMarkers
        layout={layout}
        clusters={clusters}
        onOpenFriend={onOpenFriend}
        onOpenCluster={jest.fn()}
      />,
    );
    fireEvent.press(
      screen.getByLabelText(/progression.path.friendMarkerA11y:.*"name":"nova".*"level":4/),
    );
    expect(onOpenFriend).toHaveBeenCalledWith(9);
  });

  it("opens the cluster sheet when several friends share a level", () => {
    const onOpenCluster = jest.fn();
    const friends = [
      { user_id: 1, username: "a", level: 6, profile_picture_url: null },
      { user_id: 2, username: "b", level: 6, profile_picture_url: null },
      { user_id: 3, username: "c", level: 6, profile_picture_url: null },
      { user_id: 4, username: "d", level: 6, profile_picture_url: null },
    ];
    const clusters = clusterFriendsByLevel(friends);
    render(
      <RankPathFriendMarkers
        layout={layout}
        clusters={clusters}
        onOpenFriend={jest.fn()}
        onOpenCluster={onOpenCluster}
      />,
    );
    expect(screen.getByText(/progression.path.friendOverflow:.*"count":1/)).toBeTruthy();
    fireEvent.press(
      screen.getByLabelText(/progression.path.friendClusterA11y:.*"count":4.*"level":6/),
    );
    expect(onOpenCluster).toHaveBeenCalledWith(clusters[0]);
  });
});
