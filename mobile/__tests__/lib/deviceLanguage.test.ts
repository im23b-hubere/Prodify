import { resolveDeviceLanguage } from "../../lib/deviceLanguage";

describe("resolveDeviceLanguage", () => {
  it("uses the first preferred language the app has a catalog for", () => {
    expect(resolveDeviceLanguage([{ languageTag: "de-AT", regionCode: "AT" }])).toBe("de");
    expect(resolveDeviceLanguage([{ languageTag: "en-US", regionCode: "US" }])).toBe("en");
    expect(
      resolveDeviceLanguage([
        { languageTag: "nl-NL", regionCode: "NL" },
        { languageTag: "de-DE", regionCode: "NL" },
      ]),
    ).toBe("de");
    expect(resolveDeviceLanguage([{ languageTag: "es-MX", regionCode: "MX" }])).toBe("es");
  });

  it("keeps an explicitly chosen English even in a German-speaking region", () => {
    expect(resolveDeviceLanguage([{ languageTag: "en-DE", regionCode: "DE" }])).toBe("en");
  });

  it("falls back to the region when no preferred language is in the catalog", () => {
    expect(resolveDeviceLanguage([{ languageTag: "tr-DE", regionCode: "DE" }])).toBe("de");
    expect(resolveDeviceLanguage([{ languageTag: "tr-CH", regionCode: "CH" }])).toBe("de");
    expect(resolveDeviceLanguage([{ languageTag: "it-CH", regionCode: "CH" }])).toBe("it");
    expect(resolveDeviceLanguage([{ languageTag: "ca-ES", regionCode: "ES" }])).toBe("es");
    expect(resolveDeviceLanguage([{ languageTag: "nl-NL", regionCode: "NL" }])).toBe("en");
  });

  it("sends every Portuguese variant to the Brazilian catalog", () => {
    expect(resolveDeviceLanguage([{ languageTag: "pt-BR", regionCode: "BR" }])).toBe("pt-BR");
    expect(resolveDeviceLanguage([{ languageTag: "pt-PT", regionCode: "PT" }])).toBe("pt-BR");
    expect(resolveDeviceLanguage([{ languageCode: "pt", regionCode: "PT" }])).toBe("pt-BR");
  });

  it("reads bare language codes and survives an empty locale list", () => {
    expect(resolveDeviceLanguage([{ languageCode: "de", regionCode: "DE" }])).toBe("de");
    expect(resolveDeviceLanguage([])).toBe("en");
  });
});
