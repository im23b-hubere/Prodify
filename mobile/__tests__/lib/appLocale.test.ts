import { appLocaleTag } from "../../lib/appLocale";

describe("appLocaleTag", () => {
  it("maps app languages onto BCP-47 tags for formatters", () => {
    expect(appLocaleTag("en")).toBe("en-US");
    expect(appLocaleTag("de")).toBe("de-DE");
  });
});
