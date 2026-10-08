import { colors } from "../../../constants/theme";
import type { TemplateId } from "./types";

export function validateAccent(accent: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new Error('accent must be a six-digit hex colour.');
  return accent;
}

/** Original, code-native vector artwork. All coordinates refer to 1080 × 1920. */
export function backgroundMarkup(template: TemplateId, accent: string = colors.primary): string {
  validateAccent(accent);
  if (template === 'transparent') return '';
  if (template === 'photo') {
    return '<defs><linearGradient id="photoShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000" stop-opacity="0.08"/><stop offset="0.34" stop-color="#000000" stop-opacity="0"/><stop offset="0.46" stop-color="#000000" stop-opacity="0.42"/><stop offset="0.62" stop-color="#000000" stop-opacity="0.78"/><stop offset="1" stop-color="#000000" stop-opacity="0.94"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#photoShade)"/>';
  }
  let markup = `<rect width="1080" height="1920" fill="${colors.background}"/>`;
  if (template === 'isometric') {
    markup += '<defs><clipPath id="artClip"><rect y="1288" width="1080" height="632"/></clipPath></defs><g clip-path="url(#artClip)">';
    const blocks: Array<[number, number, number, number, string, string]> = [
      [-80, 1460, 360, 560, accent, '#141414'],
      [220, 1560, 320, 480, '#141414', accent],
      [470, 1360, 380, 680, accent, '#1A1A1A'],
      [780, 1500, 360, 540, '#1F1F1F', accent],
    ];
    for (const [x, y, w, h, top, side] of blocks) {
      const half = w / 2;
      const rise = 96;
      markup += `<g><polygon points="${x},${y + rise} ${x + half},${y} ${x + w},${y + rise} ${x + half},${y + rise * 2}" fill="${top}"/><polygon points="${x},${y + rise} ${x + half},${y + rise * 2} ${x + half},${y + h} ${x},${y + h - rise}" fill="#101010"/><polygon points="${x + half},${y + rise * 2} ${x + w},${y + rise} ${x + w},${y + h - rise} ${x + half},${y + h}" fill="${side}"/></g>`;
    }
    markup += '</g>';
  }
  if (template === 'echo') {
    markup += '<defs><clipPath id="echoClip"><rect x="620" y="1040" width="460" height="880"/></clipPath></defs><g clip-path="url(#echoClip)"><g transform="translate(980 1500) rotate(-28)">';
    for (let n = 0; n < 8; n++) {
      const size = 860 - n * 86;
      markup += `<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="6" fill="none" stroke="${accent}" stroke-width="18" opacity="${0.28 + n * 0.09}"/>`;
    }
    markup += '</g></g>';
  }
  return markup;
}

export function renderBackgroundSvg(template: TemplateId, accent?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">${backgroundMarkup(template, accent)}</svg>`;
}
