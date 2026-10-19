import { matchDeviceToAppLanguage } from "../../lib/i18nLanguages";

describe("matchDeviceToAppLanguage", () => {
  const supported = ["en", "de", "tr"] as const;

  it("picks a registered device language, including regional variants", () => {
    expect(matchDeviceToAppLanguage("tr", supported, "en")).toBe("tr");
    expect(matchDeviceToAppLanguage("tr-TR", supported, "en")).toBe("tr");
    expect(matchDeviceToAppLanguage("de-AT", supported, "en")).toBe("de");
    expect(matchDeviceToAppLanguage("en_GB", supported, "en")).toBe("en");
  });

  it("falls back when the device language is not registered", () => {
    expect(matchDeviceToAppLanguage("fr", supported, "en")).toBe("en");
    expect(matchDeviceToAppLanguage(undefined, supported, "en")).toBe("en");
  });

  it("prefers an exact catalog code when both base and full tag are registered", () => {
    const withScript = ["en", "zh", "zh-Hans"] as const;
    expect(matchDeviceToAppLanguage("zh-Hans", withScript, "en")).toBe("zh-Hans");
  });

  it("walks language-tag subtags (zh-Hans-CN → zh-Hans)", () => {
    const supported = ["en", "zh-Hans", "zh-Hant"] as const;
    expect(matchDeviceToAppLanguage("zh-Hans-CN", supported, "en")).toBe("zh-Hans");
    expect(matchDeviceToAppLanguage("zh-Hant-TW", supported, "en")).toBe("zh-Hant");
  });

  it("applies catalog aliases for bare regionless codes", () => {
    const supported = ["en", "pt-BR", "pt-PT"] as const;
    const aliases = { pt: "pt-BR", "zh-cn": "zh-Hans" } as const;
    expect(matchDeviceToAppLanguage("pt", supported, "en", aliases)).toBe("pt-BR");
  });
});
