import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { SwipeSheet } from "../../../components/ui/SwipeSheet";
import type { SessionType } from "../../../constants/sessionTypes";
import type { SkillFocusId } from "../../../constants/skills";
import { colors, spacing, ui } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { skillFocusText } from "../../../lib/skillI18n";
import { remainingFocuses } from "../creditList";
import { styles } from "../sessionComplete.styles";

/** Grabber, title, divider, Save button and the sheet's own padding. */
const SHEET_CHROME_HEIGHT = 240;
const ROW_HEIGHT = 48;
const GROUP_TITLE_HEIGHT = 26;

type AddFocusSheetProps = {
  visible: boolean;
  sessionType: SessionType;
  selectedIds: readonly SkillFocusId[];
  /** The ticked focuses, in list order: kept ones first, then new ones in the order tapped. */
  onSave: (ids: SkillFocusId[]) => void;
  onClose: () => void;
};

/** Tall enough for every row, so a short list gets a short sheet. */
function sheetHeightFor(groups: { ids: SkillFocusId[] }[], showGroupTitles: boolean) {
  const rows = groups.reduce((sum, group) => sum + group.ids.length, 0);
  const titles = showGroupTitles ? groups.length * GROUP_TITLE_HEIGHT : 0;
  const gaps = Math.max(0, groups.length - 1) * spacing.lg;
  return SHEET_CHROME_HEIGHT + ui.buttonHeight + rows * ROW_HEIGHT + titles + gaps;
}

/**
 * Every focus of the session type, grouped by area when there is more than one. Credited ones
 * start ticked; taps only change the ticks, and Save applies them. Closing without saving keeps
 * the list as it was.
 */
export function AddFocusSheet({
  visible,
  sessionType,
  selectedIds,
  onSave,
  onClose,
}: AddFocusSheetProps) {
  const { t } = useTranslation();
  const groups = remainingFocuses(sessionType, []);
  const showGroupTitles = groups.length > 1;
  const [draft, setDraft] = useState<SkillFocusId[]>(() => [...selectedIds]);

  // Each open starts from what is credited right now, not from an unsaved earlier draft.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft([...selectedIds]);
  }

  const toggle = (id: SkillFocusId) => {
    Haptics.selectionAsync().catch(() => undefined);
    setDraft((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
    );
  };

  return (
    // The list scrolls, so only the grabber and title drag the sheet down.
    <SwipeSheet
      visible={visible}
      onClose={onClose}
      closeLabel={t("common.close")}
      dragAnywhere={false}
      height={sheetHeightFor(groups, showGroupTitles)}
      header={
        <View style={styles.addSheetHeader}>
          <Text style={styles.addSheetTitle} accessibilityRole="header">
            {t("sessionComplete.focusSheetTitle")}
          </Text>
        </View>
      }
    >
      {(close) => (
        <>
          <ScrollView style={styles.addSheet} contentContainerStyle={styles.addSheetList}>
            {groups.map((group) => (
              <View key={group.branch} style={styles.addGroup}>
                {showGroupTitles ? (
                  <Text style={styles.addGroupTitle}>{sessionTypeLabel(group.branch, t)}</Text>
                ) : null}
                <View style={styles.addGroupCard}>
                  {group.ids.map((id, index) => {
                    const isSelected = draft.includes(id);
                    return (
                      <Pressable
                        key={id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={skillFocusText(id, "label", t)}
                        onPress={() => toggle(id)}
                        style={({ pressed }) => [
                          styles.addRow,
                          index > 0 && styles.addRowDivider,
                          pressed && styles.addRowPressed,
                        ]}
                        testID={`add-focus-${id}`}
                      >
                        <Text style={[styles.addRowText, isSelected && styles.addRowTextSelected]}>
                          {skillFocusText(id, "short", t)}
                        </Text>
                        <View style={[styles.addCheck, isSelected && styles.addCheckSelected]}>
                          {isSelected ? (
                            <Check color={colors.textPrimary} size={14} strokeWidth={3} />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.addSheetFooter}>
            <PrimaryButton
              label={t("common.save")}
              testID="add-focus-save"
              onPress={() => {
                onSave(draft);
                close();
              }}
            />
          </View>
        </>
      )}
    </SwipeSheet>
  );
}
