import { colors } from "../../../constants/theme";
import type { TemplateId } from "./types";

export function validateAccent(accent: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new Error("accent must be a six-digit hex colour.");
  return accent;
}

/** Original, code-native vector artwork. All coordinates refer to 1080 × 1920. */
/** Paper colour of the light Mono card. */
export const MONO_LIGHT_BACKGROUND = "#F4F1EB";

export function backgroundMarkup(
  template: TemplateId,
  accent: string = colors.primary,
  monoTheme: "dark" | "light" = "dark",
): string {
  validateAccent(accent);
  if (template === "transparent") return "";
  if (template === "photo") {
    return '<defs><linearGradient id="photoShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000" stop-opacity="0.08"/><stop offset="0.34" stop-color="#000000" stop-opacity="0"/><stop offset="0.46" stop-color="#000000" stop-opacity="0.42"/><stop offset="0.62" stop-color="#000000" stop-opacity="0.78"/><stop offset="1" stop-color="#000000" stop-opacity="0.94"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#photoShade)"/>';
  }
  const paper =
    template === "mono" && monoTheme === "light" ? MONO_LIGHT_BACKGROUND : colors.background;
  let markup = `<rect width="1080" height="1920" fill="${paper}"/>`;
  if (template === "isometric") {
    markup +=
      '<defs><clipPath id="artClip"><rect y="1288" width="1080" height="632"/></clipPath></defs><g clip-path="url(#artClip)">';
    const blocks: Array<[number, number, number, number, string, string]> = [
      [-80, 1460, 360, 560, accent, "#141414"],
      [220, 1560, 320, 480, "#141414", accent],
      [470, 1360, 380, 680, accent, "#1A1A1A"],
      [780, 1500, 360, 540, "#1F1F1F", accent],
    ];
    for (const [x, y, w, h, top, side] of blocks) {
      const half = w / 2;
      const rise = 96;
      markup += `<g><polygon points="${x},${y + rise} ${x + half},${y} ${x + w},${y + rise} ${x + half},${y + rise * 2}" fill="${top}"/><polygon points="${x},${y + rise} ${x + half},${y + rise * 2} ${x + half},${y + h} ${x},${y + h - rise}" fill="#101010"/><polygon points="${x + half},${y + rise * 2} ${x + w},${y + rise} ${x + w},${y + h - rise} ${x + half},${y + h}" fill="${side}"/></g>`;
    }
    markup += "</g>";
  }
  if (template === "echo") {
    // The ripple bleeds off the card's right and bottom edges with its core fully in view,
    // so the crop reads as intentional rather than clipped mid-card.
    markup += '<g transform="translate(930 1600) rotate(-28)">';
    for (let n = 0; n < 8; n++) {
      const size = 820 - n * 82;
      markup += `<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="6" fill="none" stroke="${accent}" stroke-width="18" opacity="${0.28 + n * 0.09}"/>`;
    }
    markup += "</g>";
  }
  return markup;
}

export function renderBackgroundSvg(template: TemplateId, accent?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">${backgroundMarkup(template, accent)}</svg>`;
}
