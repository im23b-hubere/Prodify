import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { SessionCommentComposer } from "../../../features/sessions/components/SessionCommentComposer";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderComposer(overrides: Partial<ComponentProps<typeof SessionCommentComposer>> = {}) {
  const props: ComponentProps<typeof SessionCommentComposer> = {
    value: "",
    sending: false,
    sentPulse: false,
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    onFocus: jest.fn(),
    ...overrides,
  };
  render(<SessionCommentComposer {...props} />);
  return props;
}

describe("SessionCommentComposer", () => {
  it("only sends once there is text", () => {
    const empty = renderComposer();
    fireEvent.press(screen.getByLabelText("friendsScreen.commentSend"));
    expect(empty.onSubmit).not.toHaveBeenCalled();
  });

  it("forwards typing, focus and send", () => {
    const props = renderComposer({ value: "Fire beat" });
    const input = screen.getByPlaceholderText("friendsScreen.commentPlaceholder");

    fireEvent.changeText(input, "Fire beat!");
    fireEvent(input, "focus");
    fireEvent.press(screen.getByLabelText("friendsScreen.commentSend"));

    expect(props.onChange).toHaveBeenCalledWith("Fire beat!");
    expect(props.onFocus).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("blocks a second send while one is in flight", () => {
    const props = renderComposer({ value: "Fire beat", sending: true });
    fireEvent.press(screen.getByLabelText("friendsScreen.commentSend"));
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});
