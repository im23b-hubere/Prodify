import en from "../../locales/en.json";

function sectionText(blocks: { heading: string; body: string }[], heading: string): string {
  return blocks.find((block) => block.heading.includes(heading))?.body ?? "";
}

describe("in-app legal documents", () => {
  it("terms commit to zero tolerance for objectionable content", () => {
    expect(sectionText(en.legal.terms.blocks, "Community guidelines")).toContain("zero tolerance");
  });

  it("terms explain reporting, blocking and the 24-hour review", () => {
    const reporting = sectionText(en.legal.terms.blocks, "Reporting and blocking");

    expect(reporting).toContain("within 24 hours");
    expect(reporting).toContain("suspend");
  });

  it("terms name a support contact", () => {
    expect(sectionText(en.legal.terms.blocks, "Contact")).toContain("prodify@gmx.net");
  });

  it("privacy policy covers safety reports and blocks", () => {
    const safety = sectionText(en.legal.privacy.blocks, "Safety and moderation");

    expect(safety).toContain("report");
    expect(safety).toContain("block");
  });

  it("privacy policy names processors and sign-in providers", () => {
    const providers = sectionText(en.legal.privacy.blocks, "Service providers");
    const signIn = sectionText(en.legal.privacy.blocks, "Sign-in providers");

    expect(providers).toContain("RevenueCat");
    expect(providers).toContain("Sentry");
    expect(providers).toContain("Cloudflare");
    expect(providers).toContain("Render");
    expect(providers).toContain("Expo");
    expect(signIn).toContain("Sign in with Apple");
    expect(signIn).toContain("Google");
  });

  it("imprint names the operator", () => {
    expect(sectionText(en.legal.imprint.blocks, "Service provider")).toContain("Eric Huber");
    expect(sectionText(en.legal.imprint.blocks, "Address")).toContain("Switzerland");
    expect(sectionText(en.legal.imprint.blocks, "Contact")).toContain("prodify@gmx.net");
  });
});
