import { EMOJI_CATALOG } from "../../lib/emojiCatalog.generated";

/** Hand-picked sections shown above the full catalog. */
const CURATED_GROUPS: { key: string; emojis: string[] }[] = [
  {
    key: "popular",
    emojis: [
      "🔥",
      "👏",
      "💯",
      "🎯",
      "🚀",
      "❤️",
      "😍",
      "🤯",
      "🙌",
      "💪",
      "👀",
      "😂",
      "🥹",
      "🫡",
      "✨",
      "⚡",
      "🎉",
      "🏆",
    ],
  },
  {
    key: "music",
    emojis: [
      "🎵",
      "🎶",
      "🎧",
      "🎤",
      "🎹",
      "🎸",
      "🥁",
      "🎷",
      "🎺",
      "🎻",
      "🪘",
      "🔊",
      "📻",
      "💿",
      "🎛️",
      "🎚️",
      "🪩",
      "🎙️",
    ],
  },
];

/** Every section the picker browses, curated ones first, then the iOS keyboard categories. */
export const PICKER_GROUPS: { key: string; emojis: string[] }[] = [
  ...CURATED_GROUPS,
  ...EMOJI_CATALOG.map((group) => ({
    key: group.key,
    emojis: group.emojis.map(([emoji]) => emoji),
  })),
];

const SEARCH_LIMIT = 160;

/**
 * Emoji whose name or keywords contain every word of the query. Ranked: exact name, the query as
 * a whole word of the name, a whole keyword, a word starting with it, then any partial match.
 */
export function searchEmoji(query: string, limit = SEARCH_LIMIT): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const words = needle.split(/\s+/);
  const ranked: { emoji: string; rank: number; order: number }[] = [];
  let order = 0;
  for (const group of EMOJI_CATALOG) {
    for (const [emoji, terms] of group.emojis) {
      order += 1;
      if (!words.every((word) => terms.includes(word))) continue;
      const [name = "", keywords = ""] = terms.split("|");
      const all = ` ${name} ${keywords} `;
      let rank = 4;
      if (name === needle) rank = 0;
      else if (` ${name} `.includes(` ${needle} `)) rank = 1;
      else if (all.includes(` ${needle} `)) rank = 2;
      else if (all.includes(` ${words[0]}`)) rank = 3;
      ranked.push({ emoji, rank, order });
    }
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, limit)
    .map((item) => item.emoji);
}

/** Backend stores up to 16 characters (code points) per reaction. */
const MAX_EMOJI_CODE_POINTS = 16;
/**
 * One emoji: a flag (two regional indicators) or a pictograph followed by variation selectors,
 * keycaps, skin tones or zero-width-joined parts. Built at runtime so an engine without Unicode
 * property escapes falls back to the surrogate-pair range instead of failing to load the screen.
 */
const EMOJI_SEQUENCE = (() => {
  const modifiers =
    "(?:\\uFE0F|\\u20E3|[\\u{1F3FB}-\\u{1F3FF}]|\\u200D\\p{Extended_Pictographic}\\uFE0F?)*";
  try {
    return new RegExp(`(\\p{Regional_Indicator}{2}|\\p{Extended_Pictographic}${modifiers})`, "u");
  } catch {
    const pair = "[\\uD83C-\\uDBFF][\\uDC00-\\uDFFF]";
    return new RegExp(`${pair}(?:\\uFE0F|\\u200D${pair})*`);
  }
})();

/** First complete emoji in free text (so pasted or typed emoji work), or null if there is none. */
export function firstEmoji(text: string): string | null {
  const match = text.match(EMOJI_SEQUENCE);
  if (!match) return null;
  const emoji = match[0];
  return Array.from(emoji).length <= MAX_EMOJI_CODE_POINTS ? emoji : null;
}
