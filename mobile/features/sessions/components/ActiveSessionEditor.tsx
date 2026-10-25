import { Check } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { glyphRowStyle, isMoodLevel, MoodIcon } from "../../../components/icons/ProdifyGlyphs";
import { colors } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { SESSION_TYPE_IDS } from "../../../types/session";
import { ACTIVE_NOTES_MAX_LENGTH } from "../hooks/useActiveSession";
import type { ActiveSessionController } from "../hooks/useActiveSessionController";
import { sessionActiveStyles as styles } from "../sessionActive.styles";

/** Notes save themselves this long after the last keystroke (and on blur). */
const NOTES_AUTOSAVE_MS = 1200;
/** The character counter only shows up once a note gets close to the limit. */
const COUNTER_FROM = Math.round(ACTIVE_NOTES_MAX_LENGTH * 0.8);

export function ActiveSessionEditor({ controller }: { controller: ActiveSessionController }) {
  const { t } = useTranslation();
  const { session } = controller;
  if (!session) return null;
  return (
    <View style={styles.editor}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t("sessionActive.sessionType")}</Text>
        <TypePicker controller={controller} />
      </View>
      {session.mood_level && isMoodLevel(session.mood_level) ? (
        <View style={[glyphRowStyle, styles.moodRow]}>
          <Text style={styles.sectionLabel}>{t("sessionActive.mood")}</Text>
          <MoodIcon level={session.mood_level} size={20} />
        </View>
      ) : null}
      <Notes controller={controller} />
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

/** One scrolling row of types; it opens scrolled to the current one. */
function TypePicker({ controller }: { controller: ActiveSessionController }) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const revealed = useRef(false);
  const current = controller.session?.session_type;
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.typeScroller}
      contentContainerStyle={styles.typeRow}
    >
      {SESSION_TYPE_IDS.map((type) => {
        const selected = current === type;
        return (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => controller.setSessionType(type)}
            disabled={controller.busy}
            onLayout={(event) => {
              if (!selected || revealed.current) return;
              revealed.current = true;
              const x = event.nativeEvent.layout.x;
              scrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: false });
            }}
            style={[styles.typeChip, selected && styles.typeChipActive]}
          >
            <Text style={[styles.typeChipTxt, selected && styles.typeChipTxtActive]}>
              {sessionTypeLabel(type, t)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Notes({ controller }: { controller: ActiveSessionController }) {
  const { t } = useTranslation();
  const { draftNotes, saveNotes } = controller;
  const saveLatest = useRef(saveNotes);
  saveLatest.current = saveNotes;

  useEffect(() => {
    const timer = setTimeout(() => {
      saveLatest.current().catch(() => undefined);
    }, NOTES_AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draftNotes]);

  const saved =
    draftNotes.trim().length > 0 && draftNotes.trim() === (controller.session?.notes ?? "").trim();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>{t("sessionActive.notes")}</Text>
        {controller.savingNotes ? (
          <Text style={styles.notesStatus}>{t("sessionActive.saving")}</Text>
        ) : saved ? (
          <View style={styles.notesSaved}>
            <Check size={13} color={colors.success} strokeWidth={3} />
            <Text style={[styles.notesStatus, styles.notesStatusSaved]}>
              {t("sessionActive.saved")}
            </Text>
          </View>
        ) : null}
      </View>
      <TextInput
        style={styles.notesInput}
        placeholder={t("sessionActive.notesPlaceholder")}
        placeholderTextColor={colors.textSecondary}
        multiline
        textAlignVertical="top"
        maxLength={ACTIVE_NOTES_MAX_LENGTH}
        value={draftNotes}
        onChangeText={controller.setDraftNotes}
        onBlur={() => saveNotes().catch(() => undefined)}
      />
      {draftNotes.length >= COUNTER_FROM ? (
        <Text style={styles.counter}>
          {draftNotes.length}/{ACTIVE_NOTES_MAX_LENGTH}
        </Text>
      ) : null}
    </View>
  );
}
