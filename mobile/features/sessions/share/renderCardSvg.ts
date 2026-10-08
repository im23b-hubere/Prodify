import { fontFamily } from "../../../constants/fonts";
import { colors } from "../../../constants/theme";
import { activityRows, durationLabel, truncate, xmlEscape } from "./data";
import { backgroundMarkup, validateAccent } from "./backgrounds";
import type { CardOptions, SessionData } from "./types";

const ICON = 32;

/** Pure SVG renderer: same source generates native artwork and the reference files. */
export function renderCardSvg(session: SessionData, options: CardOptions): string {
  const { template } = options;
  const accent = validateAccent(options.accent ?? colors.primary);
  const rows = activityRows(session);
  const colour = template === "transparent" && options.transparentText === "black" ? "#111214" : colors.textPrimary;
  const muted = template === "photo" || template === "transparent" ? colour : colors.textSecondary;
  const display = xmlEscape(options.displayFont ?? fontFamily.heading);
  const body = xmlEscape(options.bodyFont ?? fontFamily.body);
  const medium = xmlEscape(options.bodyMediumFont ?? fontFamily.bodyMedium);
  const duration = durationLabel(session.durationSeconds);
  const date = truncate(session.dateLabel, 18);
  const username = '@' + truncate(session.producerName.replace(/^@/, ''), 22);
  const showIdentity = options.showIdentity !== false;
  const showActivities = options.showActivities !== false;
  const showStreak = options.showStreak !== false && Number.isInteger(session.streakDays) && (session.streakDays ?? 0) > 0;

  const label = (x: number, y: number, value: string, size = 34, fill = colour, weight = 400, anchor = 'start', spacing = 0, family = body) =>
    `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}" fill="${fill}">${xmlEscape(value)}</text>`;

  const brand = (x: number, y: number, center = false) =>
    `<text x="${x}" y="${y}" font-family="${display}" font-size="64" font-weight="700" letter-spacing="-1.6" text-anchor="${center ? 'middle' : 'start'}" fill="${colour}">prodify<tspan fill="${accent}">.</tspan></text>`;

  const bigTime = (x: number, y: number, center = false, size = 188) => {
    const fitted = Math.min(size, 900 / Math.max(duration.length * 0.62, 1));
    const parts = duration.match(/\d+|[hms]|\s+/g) ?? [];
    const tracking = Math.round(fitted * -0.025);
    return `<text x="${x}" y="${y}" text-anchor="${center ? 'middle' : 'start'}" font-family="${display}" font-size="${fitted}" font-weight="700" letter-spacing="${tracking}" fill="${colour}">${parts.map(part => /[hms]/.test(part) ? `<tspan font-size="${Math.round(fitted * 0.62)}" letter-spacing="${Math.round(tracking * 0.4)}">${part}</tspan>` : xmlEscape(part)).join('')}</text>`;
  };

  const flame = (x: number, y: number) =>
    `<g transform="translate(${x} ${y - 26}) scale(${ICON / 24})" fill="none" stroke="${accent}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></g>`;

  const streak = (x: number, y: number, center = false) => {
    if (!showStreak) return '';
    const text = `${session.streakDays} day streak`;
    const width = ICON + 14 + text.length * 17;
    const start = center ? x - width / 2 : x;
    return flame(start, y) + label(start + ICON + 14, y, text, 32, colour, 500, 'start', 0, medium);
  };

  const activitiesInline = (x: number, y: number, center = false) => {
    if (!showActivities) return '';
    const text = rows.map(row => truncate(row.label, 17)).join('  ·  ');
    if (Array.from(text).length <= 42) return label(x, y, text, 32, muted, 400, center ? 'middle' : 'start', 0, body);
    return rows.map((row, index) => label(x, y + index * 46, truncate(row.label, 28), 32, muted, 400, center ? 'middle' : 'start', 0, body)).join('');
  };

  const detailRows = (y: number) => showActivities
    ? rows.map((row, index) => label(96, y + index * 72, truncate(row.label, 26), 34, colour, 400, 'start', 0, body) + label(984, y + index * 72, durationLabel(row.durationSeconds), 34, muted, 500, 'end', 0, medium)).join('')
    : '';

  const header = () => brand(96, 268) + label(984, 260, date, 26, muted, 500, 'end', 1.6, medium);
  const rule = (y: number) => `<path d="M96 ${y}H984" stroke="${colors.border}" stroke-width="2"/>`;
  let content = backgroundMarkup(template, accent);

  if (template === 'photo') {
    const top = options.photoPosition === 'top';
    if (top) content = `<g transform="translate(1080 1920) rotate(180)">${content}</g>`;
    const base = top ? 300 : 1120;
    if (showIdentity) content += label(96, base, `${username}   ·   ${date}`, 28, colour, 500, 'start', 1.2, medium);
    content += bigTime(96, base + 168, false, 176);
    content += label(96, base + 236, 'Production time', 36, colour, 400, 'start', 0, body);
    content += activitiesInline(96, base + 312);
    content += streak(96, base + 392);
    content += brand(96, base + 492);
  }

  if (template === 'transparent') {
    content += label(540, 620, 'IN THE STUDIO', 26, colour, 500, 'middle', 3.2, medium);
    content += bigTime(540, 840, true, 188);
    content += label(540, 916, 'Production time', 36, colour, 400, 'middle', 0, body);
    content += `<rect x="492" y="972" width="96" height="6" rx="3" fill="${accent}"/>`;
    content += activitiesInline(540, 1068, true);
    content += streak(540, 1168, true);
    content += brand(540, 1308, true);
  }

  if (template === 'black') {
    content += header();
    content += `<circle cx="108" cy="392" r="6" fill="${accent}"/>` + label(132, 402, 'SESSION COMPLETE', 26, muted, 500, 'start', 2.4, medium);
    const parts = duration.split(' ');
    if (parts.length === 2) {
      const size = 248;
      content += label(96, 700, parts[0], size, colour, 700, 'start', -6, display);
      content += label(96, 980, parts[1], size, accent, 700, 'start', -6, display);
    } else {
      content += bigTime(96, 760, false, 220);
    }
    content += label(96, 1088, 'Made time. Made music.', 36, muted, 400, 'start', 0, body);
    content += rule(1172) + detailRows(1268);
    content += rule(1568);
    if (showIdentity) content += label(96, 1660, username, 32, muted, 500, 'start', 0, medium);
    content += streak(showIdentity ? 620 : 96, 1660);
  }

  if (template === 'timeline') {
    content += header();
    content += label(96, 420, 'TODAY IN THE STUDIO', 26, muted, 500, 'start', 2.8, medium);
    content += bigTime(96, 640, false, 188);
    content += label(96, 716, 'Your production, in focus.', 36, muted, 400, 'start', 0, body);
    if (showActivities && session.durationSeconds > 0) {
      content += label(96, 860, 'TIME BY ACTIVITY', 24, muted, 500, 'start', 2.4, medium);
      rows.forEach((row, index) => {
        const y = 960 + index * 168;
        const width = 888 * row.durationSeconds / session.durationSeconds;
        content += label(96, y, truncate(row.label, 26), 34, colour, 400, 'start', 0, body);
        content += label(984, y, durationLabel(row.durationSeconds), 32, muted, 500, 'end', 0, medium);
        content += `<rect x="96" y="${y + 22}" width="888" height="16" rx="8" fill="${colors.border}"/>`;
        if (width > 0) content += `<rect x="96" y="${y + 22}" width="${Math.max(width, 16)}" height="16" rx="8" fill="${accent}"/>`;
      });
    }
    content += rule(1568);
    content += streak(96, 1660);
    if (showIdentity) content += label(984, 1660, username, 32, muted, 500, 'end', 0, medium);
  }

  if (template === 'isometric') {
    content += header();
    content += label(96, 420, 'BUILT, ONE SESSION AT A TIME.', 26, muted, 500, 'start', 2.2, medium);
    content += bigTime(96, 640, false, 188);
    content += label(96, 716, 'Production time', 36, muted, 400, 'start', 0, body);
    content += activitiesInline(96, 812);
    content += rule(960);
    content += streak(96, 1052);
    if (showIdentity) content += label(984, 1052, username, 32, muted, 500, 'end', 0, medium);
  }

  if (template === 'echo') {
    content += header();
    content += label(96, 430, 'MAKE TIME.', 30, accent, 500, 'start', 2.6, medium);
    content += label(96, 478, 'MAKE SOMETHING.', 30, accent, 500, 'start', 2.6, medium);
    content += bigTime(96, 700, false, 188);
    content += label(96, 776, 'In the studio.', 36, muted, 400, 'start', 0, body);
    if (showActivities) {
      rows.forEach((row, index) => {
        content += label(96, 960 + index * 72, truncate(row.label, 18), 34, colour, 400, 'start', 0, body);
      });
    }
    content += streak(96, 1660);
    if (showIdentity) content += label(96, 1736, username, 32, muted, 500, 'start', 0, medium);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><title>Prodify session — ${xmlEscape(duration)}</title>${content}</svg>`;
}
