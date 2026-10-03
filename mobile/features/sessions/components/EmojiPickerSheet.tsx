import { Search, X } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { firstEmoji, PICKER_GROUPS, searchEmoji } from "../emojiPickerData";

export { firstEmoji } from "../emojiPickerData";

const COLUMNS = 8;
const HEADER_HEIGHT = 30;
/** One glyph per section for the jump bar, like the iOS emoji keyboard. */
const GROUP_ICONS: Record<string, string> = {
  popular: "🔥",
  music: "🎵",
  smileys: "😀",
  people: "👋",
  animals: "🐻",
  food: "🍔",
  travel: "✈️",
  activities: "⚽",
  objects: "💡",
  symbols: "💟",
  flags: "🏳️",
};

type Row =
  | { type: "header"; key: string; group: string }
  | { type: "emojis"; key: string; emojis: string[] };

function chunk(emojis: string[], prefix: string): Row[] {
  const rows: Row[] = [];
  for (let index = 0; index < emojis.length; index += COLUMNS) {
    rows.push({
      type: "emojis",
      key: `${prefix}-${index}`,
      emojis: emojis.slice(index, index + COLUMNS),
    });
  }
  return rows;
}

/** The full catalog as list rows: a header per section followed by rows of eight emoji. */
const BROWSE_ROWS: Row[] = PICKER_GROUPS.flatMap((group) => [
  { type: "header" as const, key: `h-${group.key}`, group: group.key },
  ...chunk(group.emojis, group.key),
]);
const HEADER_INDEX = new Map(
  BROWSE_ROWS.flatMap((row, index) => (row.type === "header" ? [[row.group, index] as const] : [])),
);

type Props = {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

/**
 * Bottom-sheet emoji picker: search by name or keyword, browse every category, or paste an emoji.
 */
export function EmojiPickerSheet({ visible, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Row>>(null);
  const [query, setQuery] = useState("");
  const cellSize = Math.floor((width - spacing.md * 2) / COLUMNS);

  const rows = useMemo(
    () => (query.trim() ? chunk(searchEmoji(query), "search") : BROWSE_ROWS),
    [query],
  );
  // Row heights are fixed, so offsets are known up front and category jumps land exactly.
  const offsets = useMemo(() => {
    const result: number[] = [];
    let offset = 0;
    for (const row of rows) {
      result.push(offset);
      offset += row.type === "header" ? HEADER_HEIGHT : cellSize;
    }
    return result;
  }, [cellSize, rows]);

  const close = () => {
    setQuery("");
    onClose();
  };
  const choose = (emoji: string) => {
    onSelect(emoji);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityLabel={t("sessionDetail.emojiPickerClose")}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.searchField}>
            <Search color={colors.textSecondary} size={16} strokeWidth={2.4} />
            <TextInput
              value={query}
              onChangeText={(text) => {
                // A typed or pasted emoji is taken straight away; words search the catalog.
                const emoji = firstEmoji(text);
                if (emoji) choose(emoji);
                else setQuery(text);
              }}
              placeholder={t("sessionDetail.emojiPickerSearchPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel={t("sessionDetail.emojiPickerSearchPlaceholder")}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("sessionDetail.emojiPickerClearSearch")}
                hitSlop={8}
                onPress={() => setQuery("")}
              >
                <X color={colors.textSecondary} size={16} strokeWidth={2.4} />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.key}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            style={styles.list}
            initialNumToRender={14}
            windowSize={7}
            getItemLayout={(_, index) => ({
              length: rows[index]?.type === "header" ? HEADER_HEIGHT : cellSize,
              offset: offsets[index] ?? 0,
              index,
            })}
            ListEmptyComponent={
              <Text style={styles.empty}>{t("sessionDetail.emojiPickerNoResults")}</Text>
            }
            renderItem={({ item }) =>
              item.type === "header" ? (
                <Text style={styles.groupTitle}>
                  {t(`sessionDetail.emojiGroups.${item.group}`)}
                </Text>
              ) : (
                <View style={styles.row}>
                  {item.emojis.map((emoji) => (
                    <Pressable
                      key={emoji}
                      accessibilityRole="button"
                      accessibilityLabel={emoji}
                      onPress={() => choose(emoji)}
                      style={({ pressed }) => [
                        styles.cell,
                        { width: cellSize, height: cellSize },
                        pressed && styles.cellPressed,
                      ]}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              )
            }
          />

          {query.trim() ? null : (
            <View style={styles.jumpBar}>
              {PICKER_GROUPS.map((group) => (
                <Pressable
                  key={group.key}
                  accessibilityRole="button"
                  accessibilityLabel={t(`sessionDetail.emojiGroups.${group.key}`)}
                  hitSlop={4}
                  onPress={() => {
                    const index = HEADER_INDEX.get(group.key);
                    if (index != null) listRef.current?.scrollToIndex({ index, animated: true });
                  }}
                  style={({ pressed }) => [styles.jumpButton, pressed && styles.cellPressed]}
                >
                  <Text style={styles.jumpIcon}>{GROUP_ICONS[group.key] ?? "•"}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    height: 520,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 40,
    borderRadius: radii.round,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  list: {
    flex: 1,
  },
  groupTitle: {
    height: HEADER_HEIGHT,
    paddingTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  cellPressed: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  emoji: {
    fontSize: 28,
  },
  empty: {
    paddingTop: spacing.lg,
    textAlign: "center",
    color: colors.textSecondary,
    ...typography.caption,
  },
  jumpBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  jumpButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  jumpIcon: {
    fontSize: 17,
  },
});
