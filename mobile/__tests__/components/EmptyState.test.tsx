import { fireEvent, render, screen } from "@testing-library/react-native";
import { Users } from "lucide-react-native";

import { EmptyState } from "../../components/states/EmptyState";

jest.mock("../../components/ui/PrimaryButton", () => {
  const React = require("react");
  const { Pressable, Text: T } = require("react-native");
  return {
    PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <T>{label}</T>
      </Pressable>
    ),
  };
});

jest.mock("../../components/ui/TextButton", () => {
  const React = require("react");
  const { Pressable, Text: T } = require("react-native");
  return {
    TextButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <T>{label}</T>
      </Pressable>
    ),
  };
});

describe("EmptyState", () => {
  it("renders title, message, and primary action", () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        title="No items"
        message="Add something to get started."
        actionLabel="Add item"
        onAction={onAction}
      />,
    );

    expect(screen.getByText("No items")).toBeTruthy();
    expect(screen.getByText("Add something to get started.")).toBeTruthy();
    fireEvent.press(screen.getByText("Add item"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("supports iconNode and secondary action in compact mode", () => {
    const onSecondary = jest.fn();
    render(
      <EmptyState
        compact
        iconNode={<Users testID="users-icon" />}
        title="Empty list"
        secondaryActionLabel="Go back"
        onSecondaryAction={onSecondary}
      />,
    );

    expect(screen.getByText("Empty list")).toBeTruthy();
    fireEvent.press(screen.getByText("Go back"));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});
