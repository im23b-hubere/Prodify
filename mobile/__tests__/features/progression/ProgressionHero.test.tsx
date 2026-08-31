import React from "react";
import { render, screen } from "@testing-library/react-native";

import { ProgressionHero } from "../../../features/progression/components/ProgressionHero";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === "progression.xpTotal") return `${params?.xp} XP total`;
      if (key === "progression.toNext") {
        return `${params?.xp} XP to ${params?.nextName} (${params?.percent}%)`;
      }
      if (key === "progression.levelNames.1") return "Bedroom Producer";
      if (key === "progression.levelNames.2") return "Loop Sketcher";
      if (key === "progression.levelNames.3") return "Beat Builder";
      if (key === "progression.levelNames.4") return "Mix Apprentice";
      if (key === "progression.levelNameFallback") return `Level ${params?.level}`;
      return key;
    },
  }),
}));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("../../../lib/progressionLevelTheme", () => ({
  levelTierFor: () => ({
    id: "starter",
    accent: "#111",
    accentSoft: "#222",
    glow: "#333",
    gradient: ["#111", "#222"],
    labelKey: "progression.tier.starter",
  }),
}));

jest.mock("../../../components/progression/LevelRankHero", () => ({
  LevelRankHeroEmblem: ({ level }: { level: number }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, { testID: "hero-level-emblem" }, `level-${level}`);
  },
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { LinearGradient: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

describe("ProgressionHero", () => {
  it("renders genuine Level 1 / 0 XP progression", () => {
    render(
      <ProgressionHero
        progression={{
          current_level: 1,
          xp_total: 0,
          xp_to_next_level: 50,
          progress_percent: 0,
        }}
        loadError={null}
      />,
    );

    expect(screen.getByTestId("progression-hero-ready")).toBeTruthy();
    expect(screen.getByText("level-1")).toBeTruthy();
    expect(screen.getByText("0 XP total")).toBeTruthy();
    expect(screen.getByText("50 XP to Loop Sketcher (0%)")).toBeTruthy();
  });

  it("renders higher-level progression unchanged", () => {
    render(
      <ProgressionHero
        progression={{
          current_level: 3,
          xp_total: 250,
          xp_to_next_level: 75,
          progress_percent: 42,
        }}
        loadError={null}
      />,
    );

    expect(screen.getByText("level-3")).toBeTruthy();
    expect(screen.getByText("250 XP total")).toBeTruthy();
    expect(screen.getByText("75 XP to Mix Apprentice (42%)")).toBeTruthy();
  });

  it("renders nothing for null progression without fabricating values", () => {
    render(<ProgressionHero progression={null} loadError={null} />);

    expect(screen.queryByTestId("progression-hero-ready")).toBeNull();
    expect(screen.queryByText(/XP total/)).toBeNull();
    expect(screen.queryByText(/level-1/)).toBeNull();
    expect(screen.queryByText(/50 XP/)).toBeNull();
  });

  it("renders nothing when load failed without fabricating values", () => {
    render(<ProgressionHero progression={null} loadError="Could not load progression." />);

    expect(screen.queryByTestId("progression-hero-ready")).toBeNull();
    expect(screen.queryByText(/0 XP total/)).toBeNull();
    expect(screen.queryByText(/level-1/)).toBeNull();
  });

  it("does not fabricate progress when progression is present but loadError is set", () => {
    render(
      <ProgressionHero
        progression={{
          current_level: 1,
          xp_total: 0,
          xp_to_next_level: 50,
          progress_percent: 0,
        }}
        loadError="stale"
      />,
    );

    expect(screen.queryByTestId("progression-hero-ready")).toBeNull();
    expect(screen.queryByText("0 XP total")).toBeNull();
  });
});
