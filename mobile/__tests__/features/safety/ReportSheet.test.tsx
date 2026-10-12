import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { ReportSheet } from "../../../features/safety/components/ReportSheet";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

function renderSheet(overrides: Partial<ComponentProps<typeof ReportSheet>> = {}) {
  const props: ComponentProps<typeof ReportSheet> = {
    visible: true,
    kind: "user",
    targetName: "bob",
    phase: "editing",
    error: null,
    onSubmit: jest.fn(),
    onBlock: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  render(<ReportSheet {...props} />);
  return props;
}

describe("ReportSheet", () => {
  it("only sends once a reason is picked", () => {
    const props = renderSheet();

    fireEvent.press(screen.getByTestId("report-submit"));

    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("sends the picked reason with the note", () => {
    const props = renderSheet();

    fireEvent.press(screen.getByTestId("report-reason-harassment"));
    fireEvent.changeText(screen.getByTestId("report-note"), "keeps insulting me");
    fireEvent.press(screen.getByTestId("report-submit"));

    expect(props.onSubmit).toHaveBeenCalledWith({ reason: "harassment", note: "keeps insulting me" });
  });

  it("marks the picked reason as selected for screen readers", () => {
    renderSheet();

    fireEvent.press(screen.getByTestId("report-reason-spam"));

    expect(screen.getByTestId("report-reason-spam").props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId("report-reason-hate").props.accessibilityState).toMatchObject({ checked: false });
  });

  it("shows why sending failed", () => {
    renderSheet({ error: "Could not send" });

    expect(screen.getByText("Could not send")).toBeTruthy();
  });

  it("confirms a sent report and offers to block as well", () => {
    const props = renderSheet({ phase: "done" });

    expect(screen.getByText("safety.report.doneTitle")).toBeTruthy();
    fireEvent.press(screen.getByTestId("report-block"));
    fireEvent.press(screen.getByTestId("report-done"));

    expect(props.onBlock).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("does not offer blocking when the person is already blocked", () => {
    renderSheet({ phase: "done", onBlock: undefined });

    expect(screen.queryByTestId("report-block")).toBeNull();
  });
});
