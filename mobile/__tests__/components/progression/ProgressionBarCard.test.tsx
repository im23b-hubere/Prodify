import React from "react";
import { render, screen } from "@testing-library/react-native";

import { ProgressionBarCard } from "../../../components/progression/ProgressionBarCard";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === "progression.levelTitle") {
        return `Lv ${params?.level} · ${params?.name}`;
      }
      if (key === "progression.xpTotal") return `${params?.xp} XP total`;
      if (key === "progression.toNext") {
        return `${params?.xp} XP to ${params?.nextName} (${params?.percent}%)`;
      }
      if (key === "progression.levelNames.1") return "Bedroom Producer";
      if (key === "progression.levelNames.2") return "Loop Sketcher";
      if (key === "progression.levelNameFallback") return `Level ${params?.level}`;
      return key;
    },
  }),
}));

const levelOneProgression = {
  xp_total: 0,
  current_level: 1,
  xp_to_next_level: 50,
  progress_percent: 0,
};

const higherProgression = {
  xp_total: 250,
  current_level: 3,
  xp_to_next_level: 75,
  progress_percent: 42,
};

describe("ProgressionBarCard", () => {
  it("displays genuine Level 1 / 0 XP progression", () => {
    render(<ProgressionBarCard progression={levelOneProgression} />);

    expect(screen.getByTestId("progression-bar-ready")).toBeTruthy();
    expect(screen.getByText("Lv 1 · Bedroom Producer")).toBeTruthy();
    expect(screen.getByText("0 XP total")).toBeTruthy();
    expect(screen.getByText("50 XP to Loop Sketcher (0%)")).toBeTruthy();
  });

  it("displays higher-level progression unchanged", () => {
    render(<ProgressionBarCard progression={higherProgression} />);

    expect(screen.getByText("Lv 3 · Level 3")).toBeTruthy();
    expect(screen.getByText("250 XP total")).toBeTruthy();
    expect(screen.getByText("75 XP to Level 4 (42%)")).toBeTruthy();
  });

  it("does not display fake progression when progression is null", () => {
    render(<ProgressionBarCard progression={null} />);

    expect(screen.getByTestId("progression-bar-unavailable")).toBeTruthy();
    expect(screen.getByText("progression.loadError")).toBeTruthy();
    expect(screen.queryByText("0 XP total")).toBeNull();
    expect(screen.queryByText(/Lv 1/)).toBeNull();
    expect(screen.queryByText(/50 XP to/)).toBeNull();
  });

  it("shows loading state without fabricated progression values", () => {
    render(<ProgressionBarCard progression={null} loading />);

    expect(screen.getByTestId("progression-bar-loading")).toBeTruthy();
    expect(screen.getByText("progression.loading")).toBeTruthy();
    expect(screen.queryByText("0 XP total")).toBeNull();
    expect(screen.queryByText(/Lv 1/)).toBeNull();
  });

  it("shows unavailable state after fetch failure semantics", () => {
    render(<ProgressionBarCard progression={null} loading={false} />);

    expect(screen.getByTestId("progression-bar-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("progression-bar-ready")).toBeNull();
  });
});
