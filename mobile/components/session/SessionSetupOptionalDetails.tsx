import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { MOOD_LEVELS, MoodIcon } from "../icons/ProdifyGlyphs";
import { AppCard } from "../ui/AppCard";
import { colors, motion } from "../../constants/theme";
import type { SessionSetupFormState } from "../../features/sessions/hooks/useSessionSetupForm";
import { sessionSetupStyles as styles } from "./sessionSetup.styles";

export function SessionSetupOptionalDetails({ form }: { form: SessionSetupFormState }) {
  const { t } = useTranslation();
  if (!form.showOptional) return null;
  return (
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
          value={form.notes}
          onChangeText={form.setNotes}
        />
        <Text style={styles.counter}>{form.notes.length}/200</Text>
        <MoodSelector form={form} />
        <TagEditor form={form} />
      </AppCard>
    </Animated.View>
  );
}

function MoodSelector({ form }: { form: SessionSetupFormState }) {
  const { t } = useTranslation();
  return (
    <>
      <Text style={styles.sectionLabel}>{t("sessionSetup.moodSection")}</Text>
      <View style={styles.moodRow}>
        {MOOD_LEVELS.map((level) => (
          <Pressable
            key={level}
            style={({ pressed }) => [
              styles.moodBtn,
              form.mood === level && styles.moodBtnActive,
              pressed && styles.moodBtnPressed,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              form.setMood(level);
            }}
          >
            <MoodIcon level={level} active={form.mood === level} size={24} />
          </Pressable>
        ))}
      </View>
    </>
  );
}

function TagEditor({ form }: { form: SessionSetupFormState }) {
  const { t } = useTranslation();
  const addSuggestedTag = (tag: string) => {
    form.addTag(tag);
    Haptics.selectionAsync().catch(() => undefined);
  };
  const addTypedTag = () => {
    form.addTag(form.tagInput);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };
  return (
    <>
      <Text style={styles.sectionLabel}>{t("sessionSetup.tagsSection")}</Text>
      <View style={styles.tagWrap}>
        {form.tags.map((tag) => (
          <Pressable
            key={tag}
            style={({ pressed }) => [styles.tagChip, pressed && styles.tagChipPressed]}
            onPress={() => form.removeTag(tag)}
          >
            <Text style={styles.tagText}>{tag}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.tagInputRow}>
        <TextInput
          style={styles.tagField}
          placeholder={t("sessionSetup.tagPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          value={form.tagInput}
          onChangeText={form.setTagInput}
          onSubmitEditing={() => form.addTag(form.tagInput)}
        />
        <Pressable
          style={({ pressed }) => [styles.addTagBtn, pressed && styles.addTagBtnPressed]}
          onPress={addTypedTag}
        >
          <Text style={styles.addTagPlus}>+</Text>
        </Pressable>
      </View>
      <View style={styles.suggestedRow}>
        {form.suggestedTags.map((tag) => (
          <Pressable
            key={tag}
            style={({ pressed }) => [styles.suggestedChip, pressed && styles.suggestedChipPressed]}
            onPress={() => addSuggestedTag(tag)}
          >
            <Text style={styles.suggestedText}>{tag}</Text>
          </Pressable>
        ))}
      </View>
      {form.tagError ? <Text style={styles.tagError}>{form.tagError}</Text> : null}
    </>
  );
}
