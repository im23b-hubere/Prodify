import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import type { SessionType } from "../../constants/sessionTypes";
import { colors, motion } from "../../constants/theme";
import { sessionSetupStyles as styles } from "./sessionSetup.styles";
import { SessionTypeSelector } from "./SessionTypeSelector";
import { useSessionSetupForm } from "../../features/sessions/hooks/useSessionSetupForm";
import { AppCard } from "../ui/AppCard";
import type { SessionDto } from "../../types/session";
import { PrimaryButton } from "../ui/PrimaryButton";

import { MOOD_LEVELS, MoodIcon } from "../icons/ProdifyGlyphs";

export type SessionSetupFormProps = {
  /** Optional preselected session type. */
  initialSessionType?: SessionType | null;
  /** Called after the session is created successfully (API returned). */
  onStarted: (session: SessionDto) => void;
  /** Server already has an active session — refresh parent state and stay calm. */
  onActiveSessionConflict?: (sessionId?: number) => void;
  /** Optional header close (e.g. modal dismiss). */
  onRequestClose?: () => void;
  /** Hide top title row (e.g. when embedded in another header). */
  hideTitleRow?: boolean;
  /** Optional override for the primary CTA label. */
  submitLabel?: string;
};

export function SessionSetupForm({
  initialSessionType = null,
  onStarted,
  onActiveSessionConflict,
  onRequestClose,
  hideTitleRow,
  submitLabel,
}: SessionSetupFormProps) {
  const { t } = useTranslation();
  const {
    selectedType,
    setSelectedType,
    notes,
    setNotes,
    mood,
    setMood,
    tags,
    removeTag,
    tagInput,
    setTagInput,
    tagError,
    suggestedTags,
    showOptional,
    toggleOptional,
    busy,
    error,
    hydrated,
    addTag,
    submit,
  } = useSessionSetupForm({
    initialSessionType,
    onStarted,
    onActiveSessionConflict,
  });
  const noteLen = notes.length;
  const canStart = selectedType !== null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={12}
    >
      {!hideTitleRow ? (
        <View style={styles.header}>
          <Text style={styles.title}>{t("dashboard.newSessionTitle")}</Text>
          {onRequestClose ? (
            <Pressable
              hitSlop={12}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                onRequestClose();
              }}
              style={styles.closeBtn}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          ) : (
            <View style={styles.closePlaceholder} />
          )}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.sectionLabel, styles.sectionLabelFirst]}>
          {t("sessionActive.sessionType")}
        </Text>
        <SessionTypeSelector selectedType={selectedType} onSelect={setSelectedType} />

        <Pressable
          style={({ pressed }) => [styles.optionalToggle, pressed && styles.optionalTogglePressed]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            toggleOptional();
          }}
        >
          <Text style={styles.optionalToggleText}>
            {showOptional
              ? t("sessionSetup.hideOptionalDetails")
              : t("sessionSetup.addOptionalDetails")}
          </Text>
          <Text style={styles.optionalToggleChevron}>{showOptional ? "−" : "+"}</Text>
        </Pressable>

        {showOptional ? (
          <Animated.View
            entering={FadeIn.duration(motion.standard)}
            exiting={FadeOut.duration(motion.quick)}
          >
            <AppCard style={styles.optionalSection}>
              <Text style={styles.sectionLabel}>{t("sessionSetup.notesSection")}</Text>
              <TextInput
                style={styles.notes}
                placeholder={t("sessionActive.notesPlaceholder")}
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
                maxLength={200}
                autoCapitalize="sentences"
                value={notes}
                onChangeText={setNotes}
              />
              <Text style={styles.counter}>{noteLen}/200</Text>

              <Text style={styles.sectionLabel}>{t("sessionSetup.moodSection")}</Text>
              <View style={styles.moodRow}>
                {MOOD_LEVELS.map((level) => (
                  <Pressable
                    key={level}
                    style={({ pressed }) => [
                      styles.moodBtn,
                      mood === level && styles.moodBtnActive,
                      pressed && styles.moodBtnPressed,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                      setMood(level);
                    }}
                  >
                    <MoodIcon level={level} active={mood === level} size={24} />
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sectionLabel}>{t("sessionSetup.tagsSection")}</Text>
              <View style={styles.tagWrap}>
                {tags.map((tg) => (
                  <Pressable
                    key={tg}
                    style={({ pressed }) => [styles.tagChip, pressed && styles.tagChipPressed]}
                    onPress={() => removeTag(tg)}
                  >
                    <Text style={styles.tagText}>{tg}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.tagInputRow}>
                <TextInput
                  style={styles.tagField}
                  placeholder={t("sessionSetup.tagPlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={() => addTag(tagInput)}
                />
                <Pressable
                  style={({ pressed }) => [styles.addTagBtn, pressed && styles.addTagBtnPressed]}
                  onPress={() => {
                    addTag(tagInput);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  }}
                >
                  <Text style={styles.addTagPlus}>+</Text>
                </Pressable>
              </View>
              <View style={styles.suggestedRow}>
                {suggestedTags.map((s) => (
                  <Pressable
                    key={s}
                    style={({ pressed }) => [
                      styles.suggestedChip,
                      pressed && styles.suggestedChipPressed,
                    ]}
                    onPress={() => {
                      addTag(s);
                      Haptics.selectionAsync().catch(() => undefined);
                    }}
                  >
                    <Text style={styles.suggestedText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
              {tagError ? <Text style={styles.tagError}>{tagError}</Text> : null}
            </AppCard>
          </Animated.View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={submitLabel ?? t("sessionSetup.startCta")}
          onPress={submit}
          loading={busy}
          disabled={!hydrated || !canStart}
          testID="session-setup-start"
        />
      </View>
    </KeyboardAvoidingView>
  );
}
