import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";

import { glyphRowStyle, isMoodLevel, MoodIcon } from "../../../components/icons/ProdifyGlyphs";
import { colors } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { SESSION_TYPE_IDS } from "../../../types/session";
import { ACTIVE_NOTES_MAX_LENGTH } from "../hooks/useActiveSession";
import type { ActiveSessionController } from "../hooks/useActiveSessionController";
import { sessionActiveStyles as styles } from "../sessionActive.styles";

export function ActiveSessionEditor({ controller }: { controller: ActiveSessionController }) {
  const { t } = useTranslation();
  const { session } = controller;
  if (!session) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.editLabel}>{t("sessionActive.sessionType")}</Text>
      <View style={styles.typeRow}>
        {SESSION_TYPE_IDS.map((type) => (
          <Pressable
            key={type}
            onPress={() => controller.setSessionType(type)}
            disabled={controller.busy}
            style={[styles.typeChip, session.session_type === type && styles.typeChipActive]}
          >
            <Text
              style={[
                styles.typeChipTxt,
                session.session_type === type && styles.typeChipTxtActive,
              ]}
            >
              {sessionTypeLabel(type, t)}
            </Text>
          </Pressable>
        ))}
      </View>
      {session.mood_level && isMoodLevel(session.mood_level) ? (
        <View style={[glyphRowStyle, styles.moodRow]}>
          <Text style={styles.row}>{t("sessionActive.mood")}</Text>
          <MoodIcon level={session.mood_level} size={20} />
        </View>
      ) : null}
      <Text style={styles.editLabel}>{t("sessionActive.notes")}</Text>
      <TextInput
        style={styles.notesInput}
        placeholder={t("sessionActive.notesPlaceholder")}
        placeholderTextColor={colors.textSecondary}
        multiline
        textAlignVertical="top"
        maxLength={ACTIVE_NOTES_MAX_LENGTH}
        value={controller.draftNotes}
        onChangeText={controller.setDraftNotes}
        onBlur={() => controller.saveNotes().catch(() => undefined)}
      />
      <NotesFooter controller={controller} />
      {controller.tagList.length > 0 ? (
        <View style={styles.tags}>
          {controller.tagList.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagTxt}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NotesFooter({ controller }: { controller: ActiveSessionController }) {
  const { t } = useTranslation();
  return (
    <View style={styles.notesFooter}>
      <Text style={styles.counter}>
        {controller.draftNotes.length}/{ACTIVE_NOTES_MAX_LENGTH}
      </Text>
      <Pressable
        onPress={() => controller.saveNotes().catch(() => undefined)}
        disabled={controller.savingNotes}
        hitSlop={8}
      >
        <Text style={styles.saveNotes}>
          {controller.savingNotes ? t("sessionActive.saving") : t("sessionActive.save")}
        </Text>
      </Pressable>
    </View>
  );
}
