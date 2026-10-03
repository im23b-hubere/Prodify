import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { firstEmoji, searchEmoji } from "../../../features/sessions/emojiPickerData";
import { SessionReactionBar } from "../../../features/sessions/components/SessionReactionBar";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

function renderBar(overrides: Partial<ComponentProps<typeof SessionReactionBar>> = {}) {
  const props: ComponentProps<typeof SessionReactionBar> = {
    reactions: [
      { target_type: "session", target_id: 12, emoji: "🔥", count: 3, reacted_by_me: true },
      { target_type: "session", target_id: 12, emoji: "🦄", count: 1, reacted_by_me: false },
    ],
    loading: false,
    error: null,
    busyEmoji: null,
    onToggle: jest.fn(),
    ...overrides,
  };
  render(<SessionReactionBar {...props} />);
  return props;
}

describe("SessionReactionBar", () => {
  it("offers the quick reactions plus custom emoji friends used", () => {
    const props = renderBar();

    expect(screen.getByText("👏")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    fireEvent.press(screen.getByText("🦄"));
    expect(props.onToggle).toHaveBeenCalledWith("🦄");
  });

  it("adds a reaction from the picker without removing one you already gave", () => {
    const props = renderBar();

    fireEvent.press(screen.getByLabelText("sessionDetail.addReactionA11y"));
    fireEvent.press(screen.getAllByLabelText("🎧")[0]!);
    expect(props.onToggle).toHaveBeenCalledWith("🎧");

    fireEvent.press(screen.getByLabelText("sessionDetail.addReactionA11y"));
    fireEvent.press(screen.getAllByLabelText("🔥").at(-1)!);
    expect(props.onToggle).not.toHaveBeenCalledWith("🔥");
  });

  it("searches by name and reacts with a result", () => {
    const props = renderBar();

    fireEvent.press(screen.getByLabelText("sessionDetail.addReactionA11y"));
    fireEvent.changeText(
      screen.getByLabelText("sessionDetail.emojiPickerSearchPlaceholder"),
      "guitar",
    );
    fireEvent.press(screen.getByLabelText("🎸"));
    expect(props.onToggle).toHaveBeenCalledWith("🎸");
  });

  it("says so when nothing matches", () => {
    renderBar();

    fireEvent.press(screen.getByLabelText("sessionDetail.addReactionA11y"));
    fireEvent.changeText(
      screen.getByLabelText("sessionDetail.emojiPickerSearchPlaceholder"),
      "zzqx",
    );
    expect(screen.getByText("sessionDetail.emojiPickerNoResults")).toBeTruthy();
  });

  it("takes a pasted emoji straight away", () => {
    const props = renderBar();

    fireEvent.press(screen.getByLabelText("sessionDetail.addReactionA11y"));
    fireEvent.changeText(screen.getByLabelText("sessionDetail.emojiPickerSearchPlaceholder"), "🧑‍🎤");
    expect(props.onToggle).toHaveBeenCalledWith("🧑‍🎤");
  });

  it("shows reaction errors", () => {
    renderBar({ error: "reactions unavailable" });
    expect(screen.getByText("reactions unavailable")).toBeTruthy();
  });
});

describe("firstEmoji", () => {
  it("extracts a single emoji, including skin tones, ZWJ sequences and flags", () => {
    expect(firstEmoji("hi 🔥 there")).toBe("🔥");
    expect(firstEmoji("👍🏽")).toBe("👍🏽");
    expect(firstEmoji("🧑‍🎤")).toBe("🧑‍🎤");
    expect(firstEmoji("🇩🇪")).toBe("🇩🇪");
    expect(firstEmoji("❤️")).toBe("❤️");
  });

  it("rejects plain text", () => {
    expect(firstEmoji("nice")).toBeNull();
    expect(firstEmoji("")).toBeNull();
  });
});

describe("searchEmoji", () => {
  it("finds emoji by name and keyword, best name matches first", () => {
    expect(searchEmoji("fire")[0]).toBe("🔥");
    expect(searchEmoji("heart")).toContain("❤️");
    expect(searchEmoji("headphone")).toContain("🎧");
  });

  it("requires every word and ignores empty queries", () => {
    expect(searchEmoji("red heart")).toContain("❤️");
    expect(searchEmoji("red heart")).not.toContain("💙");
    expect(searchEmoji("   ")).toEqual([]);
  });
});
