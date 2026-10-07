import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { SessionType } from "../../../constants/sessionTypes";
import type { SkillFocusId } from "../../../constants/skills";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { skillFocusText } from "../../../lib/skillI18n";
import { remainingFocuses } from "../creditList";
import { styles } from "../sessionComplete.styles";

type AddFocusSheetProps = {
  visible: boolean;
  sessionType: SessionType;
  selectedIds: readonly SkillFocusId[];
  onAdd: (id: SkillFocusId) => void;
  onClose: () => void;
};

/** Remaining catalog focuses, grouped by area when the session type has more than one. */
export function AddFocusSheet({
  visible,
  sessionType,
  selectedIds,
  onAdd,
  onClose,
}: AddFocusSheetProps) {
  const { t } = useTranslation();
  const groups = remainingFocuses(sessionType, selectedIds);
  const showGroupTitles = groups.length > 1;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={["top", "bottom"]} style={styles.addSheet}>
        <Text style={styles.addSheetTitle} accessibilityRole="header">
          {t("sessionComplete.addFocus")}
        </Text>
        <ScrollView contentContainerStyle={styles.addSheetList}>
          {groups.map((group) => (
            <View key={group.branch} style={styles.addGroup}>
              {showGroupTitles ? (
                <Text style={styles.addGroupTitle}>{sessionTypeLabel(group.branch, t)}</Text>
              ) : null}
              {group.ids.map((id) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={skillFocusText(id, "label", t)}
                  onPress={() => onAdd(id)}
                  style={({ pressed }) => [styles.addRow, pressed && styles.focusRetryPressed]}
                  testID={`add-focus-${id}`}
                >
                  <Text style={styles.addRowText}>{skillFocusText(id, "short", t)}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
