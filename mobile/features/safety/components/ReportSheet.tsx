import * as Haptics from "expo-haptics";
import { CircleCheck, Flag } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors } from "../../../constants/theme";
import type { ReportDraft, ReportReason } from "../../../lib/moderation";
import type { ReportPhase } from "../hooks/useReportFlow";
import { reportSheetStyles as styles } from "./reportSheet.styles";

const REASONS: ReportReason[] = ["harassment", "hate", "sexual", "spam", "other"];
const NOTE_MAX_LENGTH = 500;

type Props = {
  visible: boolean;
  kind: "user" | "comment";
  targetName: string;
  phase: ReportPhase;
  error: string | null;
  onSubmit: (draft: ReportDraft) => void;
  /** Offered after sending; leave out when the person is already blocked. */
  onBlock?: () => void;
  onClose: () => void;
};

export function ReportSheet({ visible, onClose, ...content }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        testID="report-sheet"
      >
        <View style={styles.grabber} />
        {content.phase === "done" ? (
          <ReportSent targetName={content.targetName} onBlock={content.onBlock} onClose={onClose} />
        ) : (
          <ReportForm {...content} onClose={onClose} />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReportForm({
  kind,
  targetName,
  phase,
  error,
  onSubmit,
  onClose,
}: Omit<Props, "visible" | "onBlock">) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const submitting = phase === "submitting";

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Flag color={colors.primary} size={20} strokeWidth={2.2} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {kind === "user"
            ? t("safety.report.userTitle", { name: targetName })
            : t("safety.report.commentTitle", { name: targetName })}
        </Text>
        <Text style={styles.subtitle}>{t("safety.report.subtitle")}</Text>
      </View>

      <View style={styles.reasonList} accessibilityRole="radiogroup">
        {REASONS.map((option) => (
          <ReasonRow
            key={option}
            reason={option}
            selected={reason === option}
            onSelect={() => {
              Haptics.selectionAsync().catch(() => undefined);
              setReason(option);
            }}
          />
        ))}
      </View>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={t("safety.report.notePlaceholder")}
        placeholderTextColor={colors.textSecondary}
        maxLength={NOTE_MAX_LENGTH}
        multiline
        style={styles.note}
        accessibilityLabel={t("safety.report.noteLabel")}
        testID="report-note"
      />

      {error ? (
        <Animated.Text entering={FadeIn.duration(180)} style={styles.error} accessibilityRole="alert">
          {error}
        </Animated.Text>
      ) : null}

      <PrimaryButton
        label={t("safety.report.submit")}
        onPress={() => {
          if (reason) onSubmit({ reason, note });
        }}
        disabled={reason === null}
        loading={submitting}
        testID="report-submit"
      />
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
        onPress={onClose}
        disabled={submitting}
      >
        <Text style={styles.secondaryActionText}>{t("common.cancel")}</Text>
      </Pressable>
    </ScrollView>
  );
}

function ReasonRow({
  reason,
  selected,
  onSelect,
}: {
  reason: ReportReason;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityHint={t(`safety.report.reasons.${reason}.hint`)}
      style={({ pressed }) => [styles.reasonRow, selected && styles.reasonRowSelected, pressed && styles.pressed]}
      onPress={onSelect}
      testID={`report-reason-${reason}`}
    >
      <View style={styles.reasonCopy}>
        <Text style={styles.reasonLabel}>{t(`safety.report.reasons.${reason}.label`)}</Text>
        <Text style={styles.reasonHint}>{t(`safety.report.reasons.${reason}.hint`)}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

function ReportSent({
  targetName,
  onBlock,
  onClose,
}: {
  targetName: string;
  onBlock?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.content, styles.doneContent]}>
      <CircleCheck color={colors.success} size={44} strokeWidth={2} />
      <Text style={styles.title} accessibilityRole="header">
        {t("safety.report.doneTitle")}
      </Text>
      <Text style={[styles.subtitle, styles.centeredText]}>{t("safety.report.doneBody")}</Text>
      <View style={styles.doneActions}>
        {onBlock ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.blockAction, pressed && styles.pressed]}
            onPress={onBlock}
            testID="report-block"
          >
            <Text style={styles.blockActionText}>{t("safety.report.alsoBlock", { name: targetName })}</Text>
          </Pressable>
        ) : null}
        <PrimaryButton label={t("safety.report.done")} onPress={onClose} testID="report-done" />
      </View>
    </Animated.View>
  );
}
