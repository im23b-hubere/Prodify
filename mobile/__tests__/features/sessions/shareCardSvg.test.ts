import type { TFunction } from "i18next";

import { colors } from "../../../constants/theme";
import { fontFamily } from "../../../constants/fonts";
import { renderCardSvg } from "../../../features/sessions/share/renderCardSvg";
import { sessionShareData } from "../../../features/sessions/share/sessionShareData";
import { TEMPLATE_IDS } from "../../../features/sessions/share/types";
import type { SessionDto } from "../../../types/session";

const t = ((key: string, options?: { count?: number; duration?: string; h?: number; m?: number }) => {
  const catalog: Record<string, string> = {
    "shareCard.productionTime": "Production time",
    "shareCard.inTheStudio": "IN THE STUDIO",
    "shareCard.inTheStudioSentence": "In the studio.",
    "shareCard.sessionComplete": "SESSION COMPLETE",
    "shareCard.builtOneSession": "BUILT, ONE SESSION AT A TIME.",
    "shareCard.makeTime": "MAKE TIME.",
    "shareCard.makeSomething": "MAKE SOMETHING.",
    "shareCard.activityProduction": "Production",
    "shareCard.activityOther": "Other",
  };
  if (key === "shareCard.dayStreak") return `${options?.count} day streak`;
  if (key === "shareCard.svgTitle") return `Prodify session — ${options?.duration}`;
  if (key === "shareCard.durationSeconds") return `${options?.count}s`;
  if (key === "shareCard.durationMinutes") return `${options?.count}m`;
  if (key === "shareCard.durationHoursMinutes") return `${options?.h}h ${options?.m}m`;
  if (key.startsWith("skills.")) return key;
  return catalog[key] ?? key;
}) as TFunction;

const session: SessionDto = {
  id: 4,
  user_id: 1,
  session_type: "production",
  started_at: "2026-10-07T18:00:00Z",
  stopped_at: "2026-10-07T19:47:00Z",
  duration_seconds: 6420,
  notes: null,
  focus_times: [
    { skill_id: "beat_making.drums", assigned_seconds: 3480 },
    { skill_id: "arrangement.structure", assigned_seconds: 1860 },
  ],
};

describe("share card svg", () => {
  const data = sessionShareData(session, "erix", t);

  it("uses the loaded Prodify fonts and accent on every template", () => {
    for (const template of TEMPLATE_IDS) {
      const svg = renderCardSvg(data, { template }, t);
      expect(svg).toContain(`font-family="${fontFamily.heading}"`);
      expect(svg).toContain(`font-family="${fontFamily.body}"`);
      expect(svg).toContain(colors.primary);
      expect(svg).toContain('width="1080"');
      expect(svg).toContain('height="1920"');
    }
  });

  it("only uses SVG features that react-native-svg can draw on iOS", () => {
    for (const template of TEMPLATE_IDS) {
      expect(renderCardSvg(data, { template }, t)).not.toMatch(/feDropShadow|filter=/);
    }
  });

  it("keeps the transparent card free of a background fill", () => {
    const svg = renderCardSvg(data, { template: "transparent" }, t);
    expect(svg).not.toContain(`fill="${colors.background}"`);
  });

  it("maps focus time into activity labels without exceeding the session", () => {
    expect(data.dateLabel).toBe("07 OCT 2026");
    expect(data.producerName).toBe("erix");
    expect(data.activities.reduce((sum, row) => sum + row.durationSeconds, 0)).toBeLessThanOrEqual(
      6420,
    );
    expect(renderCardSvg(data, { template: "mono" }, t)).toContain("@erix");
  });

  it("leaves weights to the app's single-weight font files, but sets them for generic families", () => {
    for (const template of TEMPLATE_IDS) {
      expect(renderCardSvg(data, { template }, t)).not.toContain("font-weight=");
    }
    const generic = renderCardSvg(
      data,
      {
        template: "isometric",
        displayFont: "Syne",
        bodyFont: "DM Sans",
        bodyMediumFont: "DM Sans Medium",
      },
      t,
    );
    expect(generic).toContain('font-weight="700"');
  });

  it("draws Mono as a black or a warm white card", () => {
    const dark = renderCardSvg(data, { template: "mono" }, t);
    const light = renderCardSvg(data, { template: "mono", monoTheme: "light" }, t);
    expect(dark).toContain(`fill="${colors.background}"`);
    expect(light).toContain('fill="#F4F1EB"');
    expect(light).toContain('fill="#0B0B0C"');
    expect(light).toContain(colors.primary);
  });

  it("leaves the repeated Production line off a transparent card without activities", () => {
    const bare = { ...data, activities: [] };
    expect(renderCardSvg(bare, { template: "transparent" }, t)).not.toContain(">Production</text>");
    expect(renderCardSvg(data, { template: "transparent" }, t)).toContain("prodify");
  });

  it("pulls card chrome copy through t()", () => {
    const echo = renderCardSvg(data, { template: "echo" }, t);
    expect(echo).toContain("MAKE TIME.");
    expect(echo).toContain("In the studio.");
    expect(echo).toContain("Prodify session —");
    expect(renderCardSvg(data, { template: "mono" }, t)).toContain("Production time");
  });
});
