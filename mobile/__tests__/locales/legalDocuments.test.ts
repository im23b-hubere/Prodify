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
    expect(sectionText(en.legal.terms.blocks, "Contact")).toContain("support@prodify.app");
  });

  it("privacy policy covers safety reports and blocks", () => {
    const safety = sectionText(en.legal.privacy.blocks, "Safety and moderation");

    expect(safety).toContain("report");
    expect(safety).toContain("block");
  });
});
