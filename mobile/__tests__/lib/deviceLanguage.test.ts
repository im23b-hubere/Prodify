import { resolveDeviceLanguage } from "../../lib/deviceLanguage";

describe("resolveDeviceLanguage", () => {
  it("uses the first preferred language the app has a catalog for", () => {
    expect(resolveDeviceLanguage([{ languageTag: "de-AT", regionCode: "AT" }])).toBe("de");
    expect(resolveDeviceLanguage([{ languageTag: "en-US", regionCode: "US" }])).toBe("en");
    expect(
      resolveDeviceLanguage([
        { languageTag: "fr-FR", regionCode: "FR" },
        { languageTag: "de-DE", regionCode: "FR" },
      ]),
    ).toBe("de");
  });

  it("keeps an explicitly chosen English even in a German-speaking region", () => {
    expect(resolveDeviceLanguage([{ languageTag: "en-DE", regionCode: "DE" }])).toBe("en");
  });

  it("falls back to the region when no preferred language is in the catalog", () => {
    expect(resolveDeviceLanguage([{ languageTag: "tr-DE", regionCode: "DE" }])).toBe("de");
    expect(resolveDeviceLanguage([{ languageTag: "it-CH", regionCode: "CH" }])).toBe("de");
    expect(resolveDeviceLanguage([{ languageTag: "fr-FR", regionCode: "FR" }])).toBe("en");
  });

  it("reads bare language codes and survives an empty locale list", () => {
    expect(resolveDeviceLanguage([{ languageCode: "de", regionCode: "DE" }])).toBe("de");
    expect(resolveDeviceLanguage([])).toBe("en");
  });
});
