import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import type { SessionType } from "../../constants/sessionTypes";
import { useSessionSetupForm } from "../../features/sessions/hooks/useSessionSetupForm";
import type { SessionDto } from "../../types/session";
import { PrimaryButton } from "../ui/PrimaryButton";
import { sessionSetupStyles as styles } from "./sessionSetup.styles";
import { SessionSetupHeader } from "./SessionSetupHeader";
import { SessionSetupOptionalDetails } from "./SessionSetupOptionalDetails";
import { SessionTypeSelector } from "./SessionTypeSelector";

export type SessionSetupFormProps = {
  initialSessionType?: SessionType | null;
  onStarted: (session: SessionDto) => void;
  onActiveSessionConflict?: (sessionId?: number) => void;
  onRequestClose?: () => void;
  hideTitleRow?: boolean;
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
  const form = useSessionSetupForm({ initialSessionType, onStarted, onActiveSessionConflict });
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={12}
    >
      {!hideTitleRow ? <SessionSetupHeader onClose={onRequestClose} /> : null}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.sectionLabel, styles.sectionLabelFirst]}>
          {t("sessionActive.sessionType")}
        </Text>
        <SessionTypeSelector selectedType={form.selectedType} onSelect={form.setSelectedType} />
        <Pressable
          style={({ pressed }) => [styles.optionalToggle, pressed && styles.optionalTogglePressed]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            form.toggleOptional();
          }}
        >
          <Text style={styles.optionalToggleText}>
            {form.showOptional
              ? t("sessionSetup.hideOptionalDetails")
              : t("sessionSetup.addOptionalDetails")}
          </Text>
          <Text style={styles.optionalToggleChevron}>{form.showOptional ? "−" : "+"}</Text>
        </Pressable>
        <SessionSetupOptionalDetails form={form} />
        {form.error ? <Text style={styles.error}>{form.error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          label={submitLabel ?? t("sessionSetup.startCta")}
          onPress={form.submit}
          loading={form.busy}
          disabled={!form.hydrated || !form.selectedType}
          testID="session-setup-start"
        />
      </View>
    </KeyboardAvoidingView>
  );
}
