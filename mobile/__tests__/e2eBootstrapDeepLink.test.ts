import { parseE2eBootstrapDeepLink } from "../lib/e2eBootstrapDeepLink";

jest.mock("../lib/e2eMode", () => ({
  isE2eModeEnabled: () => true,
}));

describe("e2eBootstrapDeepLink", () => {
  it("parses bootstrap credentials including special characters in password", () => {
    expect(
      parseE2eBootstrapDeepLink(
        "prodify://e2e/bootstrap?email=test%40prodify.app&password=Test1234%21",
      ),
    ).toEqual({
      email: "test@prodify.app",
      password: "Test1234!",
    });
  });

  it("parses unencoded query values without truncating at exclamation marks", () => {
    expect(
      parseE2eBootstrapDeepLink(
        "prodify://e2e/bootstrap?email=test@prodify.app&password=Test1234!",
      ),
    ).toEqual({
      email: "test@prodify.app",
      password: "Test1234!",
    });
  });

  it("returns null for non-bootstrap links", () => {
    expect(parseE2eBootstrapDeepLink("prodify://dashboard")).toBeNull();
  });
});
