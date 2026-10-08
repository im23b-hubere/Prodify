import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { sessionMoodLabel, sessionTypeLabel } from "../../../lib/sessionI18n";
import { skillFocusText } from "../../../lib/skillI18n";
import type { SessionDto, SessionType } from "../../../types/session";
import type { FocusReflectionSelection } from "../hooks/useFocusReflectionSelection";
import type { SessionDetailPresentation } from "../sessionDetailPresentation";
import { focusesAllowedForSessionType } from "../skillFocusSelection";
import { SessionTypeDropdown } from "./SessionTypeDropdown";
import { WorkedOnEditor } from "./WorkedOnEditor";

const NOTES_MAX_LENGTH = 2000;

type SessionDetailMetadataProps = {
  session: SessionDto;
  presentation: SessionDetailPresentation;
  isOwnSession: boolean;
  selectedType: SessionType;
  note: string;
  onTypeChange: (type: SessionType) => void;
  onNoteChange: (note: string) => void;
  focusSelection: FocusReflectionSelection;
  canEditFocuses: boolean;
};

function SessionTypeSection({
  session,
  isOwnSession,
  selectedType,
  onTypeChange,
}: Pick<SessionDetailMetadataProps, "session" | "isOwnSession" | "selectedType" | "onTypeChange">) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("sessionDetail.sessionType")}</Text>
      {isOwnSession ? (
        <SessionTypeDropdown value={selectedType} onChange={onTypeChange} />
      ) : (
        <Text style={styles.readOnlyValue}>{sessionTypeLabel(session.session_type, t)}</Text>
      )}
    </View>
  );
}

function NotesSection({
  isOwnSession,
  note,
  onNoteChange,
}: Pick<SessionDetailMetadataProps, "isOwnSession" | "note" | "onNoteChange">) {
  const { t } = useTranslation();
  // Your own notes stay editable even when empty; a friend's empty notes are simply not shown.
  if (!isOwnSession && !note.trim()) return null;
  let content = <Text style={styles.noteReadOnly}>{note}</Text>;
  if (isOwnSession) {
    content = (
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
    );
  }
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("sessionDetail.notes")}</Text>
      {content}
    </View>
  );
}

function SkillFocusSection({
  session,
  selectedType,
  focusSelection,
  canEditFocuses,
}: Pick<
  SessionDetailMetadataProps,
  "session" | "selectedType" | "focusSelection" | "canEditFocuses"
>) {
  const { t } = useTranslation();
  if (canEditFocuses) {
    return (
      <View style={styles.section} testID="session-detail-focus-editor">
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {t("sessionComplete.workedOn")}
        </Text>
        <WorkedOnEditor
          selection={focusSelection}
          durationSeconds={session.duration_seconds ?? 0}
          sessionType={selectedType}
        />
      </View>
    );
  }
  // Mirrors the server: changing the session type drops focuses from other branches on save.
  const focusIds = focusesAllowedForSessionType(session.skill_focus_ids ?? [], selectedType);
  if (focusIds.length === 0) return null;
  const mainFocusId = session.primary_skill_focus_id ?? null;
  const orderedIds = [...focusIds].sort(
    (a, b) => Number(b === mainFocusId) - Number(a === mainFocusId),
  );
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("sessionDetail.skillFocus")}</Text>
      <View style={styles.tagRow}>
        {orderedIds.map((id) => {
          const isMainFocus = id === mainFocusId;
          return (
            <View
              key={id}
              style={[styles.tag, isMainFocus && styles.mainFocusTag]}
              accessibilityLabel={
                isMainFocus
                  ? `${skillFocusText(id, "label", t)}, ${t("sessionComplete.mainFocus")}`
                  : skillFocusText(id, "label", t)
              }
              accessibilityHint={skillFocusText(id, "description", t)}
            >
              <Text style={styles.tagText}>
                {isMainFocus ? "★ " : ""}
                {skillFocusText(id, "label", t)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TagsSection({ tags }: { tags: string[] }) {
  const { t } = useTranslation();
  if (tags.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("sessionDetail.tags")}</Text>
      <View style={styles.tagRow}>
        {tags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Mood and pauses side by side; a fact without data is left out instead of showing a dash. */
function FactsRow({ cells }: { cells: ({ label: string; value: string } | null)[] }) {
  const shown = cells.filter((cell): cell is { label: string; value: string } => cell != null);
  if (shown.length === 0) return null;
  return (
    <View style={styles.grid}>
      {shown.map((cell) => (
        <View key={cell.label} style={styles.gridCell}>
          <Text style={styles.gridLabel}>{cell.label}</Text>
          <Text style={styles.gridValue}>{cell.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function SessionDetailMetadata({
  session,
  presentation,
  isOwnSession,
  selectedType,
  note,
  onTypeChange,
  onNoteChange,
  focusSelection,
  canEditFocuses,
}: SessionDetailMetadataProps) {
  const { t } = useTranslation();
  return (
    <>
      <FactsRow
        cells={[
          session.mood_level
            ? { label: t("sessionDetail.mood"), value: sessionMoodLabel(session.mood_level, t) }
            : null,
          presentation.hasMeaningfulPause
            ? {
                label: t("sessionDetail.pauses"),
                value: t("sessionDetail.pauseSummary", {
                  count: presentation.pauseCount,
                  m: Math.round(presentation.pauseSeconds / 60),
                }),
              }
            : null,
        ]}
      />
      {/* For a friend the type is already the header's title; only your own is editable here. */}
      {isOwnSession ? (
        <SessionTypeSection
          session={session}
          isOwnSession={isOwnSession}
          selectedType={selectedType}
          onTypeChange={onTypeChange}
        />
      ) : null}
      <SkillFocusSection
        session={session}
        selectedType={selectedType}
        focusSelection={focusSelection}
        canEditFocuses={canEditFocuses}
      />
      <NotesSection isOwnSession={isOwnSession} note={note} onNoteChange={onNoteChange} />
      <TagsSection tags={presentation.tags} />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", gap: spacing.sm },
  gridCell: {
    flex: 1,
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
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  mainFocusTag: { backgroundColor: "rgba(162,89,255,0.4)" },
  tagText: { color: colors.textPrimary, ...typography.caption },
});
