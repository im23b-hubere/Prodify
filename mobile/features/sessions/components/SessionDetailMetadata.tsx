import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { SessionTypeChip } from "../../../components/ui/SessionTypeChip";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { sessionMoodLabel, sessionTypeLabel } from "../../../lib/sessionI18n";
import { SESSION_TYPE_IDS, type SessionDto, type SessionType } from "../../../types/session";
import type { SessionDetailPresentation } from "../sessionDetailPresentation";

const NOTES_MAX_LENGTH = 2000;

type SessionDetailMetadataProps = {
  session: SessionDto;
  presentation: SessionDetailPresentation;
  isOwnSession: boolean;
  selectedType: SessionType;
  note: string;
  onTypeChange: (type: SessionType) => void;
  onNoteChange: (note: string) => void;
};

export function SessionDetailMetadata({
  session,
  presentation,
  isOwnSession,
  selectedType,
  note,
  onTypeChange,
  onNoteChange,
}: SessionDetailMetadataProps) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.grid}>
        <View style={styles.gridCell}>
          <Text style={styles.gridLabel}>{t("sessionDetail.mood")}</Text>
          <Text style={styles.gridValue}>
            {session.mood_level ? sessionMoodLabel(session.mood_level, t) : "—"}
          </Text>
        </View>
        <View style={styles.gridCell}>
          <Text style={styles.gridLabel}>{t("sessionDetail.pauses")}</Text>
          <Text style={styles.gridValue}>
            {presentation.hasMeaningfulPause
              ? t("sessionDetail.pauseSummary", {
                  count: presentation.pauseCount,
                  m: Math.round(presentation.pauseSeconds / 60),
                })
              : "—"}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("sessionDetail.sessionType")}</Text>
        {isOwnSession ? (
          <View style={styles.chips}>
            {SESSION_TYPE_IDS.map((type) => (
              <SessionTypeChip
                key={type}
                label={sessionTypeLabel(type, t)}
                active={selectedType === type}
                onPress={() => onTypeChange(type)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.readOnlyValue}>{sessionTypeLabel(session.session_type, t)}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("sessionDetail.notes")}</Text>
        {isOwnSession ? (
          <>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={onNoteChange}
              placeholder={t("sessionDetail.notesPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={NOTES_MAX_LENGTH}
            />
            <Text style={styles.noteCounter}>
              {note.length}/{NOTES_MAX_LENGTH}
            </Text>
          </>
        ) : note.trim() ? (
          <Text style={styles.noteReadOnly}>{note}</Text>
        ) : (
          <Text style={styles.mutedNote}>{t("sessionDetail.noNotes")}</Text>
        )}
      </View>

      {presentation.tags.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("sessionDetail.tags")}</Text>
          <View style={styles.tagRow}>
            {presentation.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridCell: {
    width: "47%",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  gridLabel: { color: colors.textSecondary, ...typography.caption },
  gridValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    marginTop: 4,
    ...typography.body,
  },
  section: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  readOnlyValue: { color: colors.textPrimary, fontFamily: fontFamily.body, ...typography.body },
  noteInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: "top",
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  noteCounter: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    textAlign: "right",
    ...typography.caption,
  },
  noteReadOnly: {
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    ...typography.body,
    lineHeight: 22,
  },
  mutedNote: { color: colors.textSecondary, ...typography.caption },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.round,
    backgroundColor: "rgba(162,89,255,0.2)",
  },
  tagText: { color: colors.textPrimary, ...typography.caption },
});
