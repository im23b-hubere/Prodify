import { appLocaleTag } from "../../lib/appLocale";

describe("appLocaleTag", () => {
  it("maps app languages onto BCP-47 tags for formatters", () => {
    expect(appLocaleTag("en")).toBe("en-GB");
    expect(appLocaleTag("de")).toBe("de-DE");
    expect(appLocaleTag("pt-BR")).toBe("pt-BR");
  });
});
