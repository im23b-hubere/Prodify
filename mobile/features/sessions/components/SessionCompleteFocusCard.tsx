import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import type { SessionType } from "../../../constants/sessionTypes";
import { colors, motion } from "../../../constants/theme";
import type { SessionDto } from "../../../types/session";
import { useSessionFocusReflection } from "../hooks/useSessionFocusReflection";
import type { FocusSaveStatus } from "../hooks/useSkillFocusSync";
import { styles } from "../sessionComplete.styles";
import { shouldNudgeWorkedOn } from "../sessionCompletePresentation";
import { WorkedOnEditor } from "./WorkedOnEditor";

type SessionCompleteFocusCardProps = {
  session: SessionDto;
  sessionType: SessionType;
  totalSessions: number | null;
};

export function SessionCompleteFocusCard({
  session,
  sessionType,
  totalSessions,
}: SessionCompleteFocusCardProps) {
  const reflection = useSessionFocusReflection(session, sessionType);
  const accent = sessionTypeAccent(sessionType);
  const credited = reflection.selection.committedReflection;
  const nudge = shouldNudgeWorkedOn(totalSessions, credited.focusIds.length);

  return (
    <Animated.View
      entering={FadeInDown.duration(motion.standard).delay(motion.quick)}
      style={[
        styles.focusCard,
        { borderColor: `${accent}40` },
        nudge ? styles.focusCardNudge : null,
      ]}
      testID="session-complete-focus"
    >
      <View style={styles.focusCardHeader}>
        <WorkedOnTitle />
        <SaveStatusIndicator status={reflection.saveStatus} />
      </View>
      <WorkedOnEditor
        selection={reflection.selection}
        durationSeconds={session.duration_seconds ?? 0}
        sessionType={sessionType}
        progressBySkill={reflection.progressBySkill}
        nudge={nudge}
      />
      {reflection.saveStatus === "error" ? <SaveErrorRow onRetry={reflection.retrySave} /> : null}
    </Animated.View>
  );
}

function WorkedOnTitle() {
  const { t } = useTranslation();
  return (
    <Text style={styles.focusCardTitle} accessibilityRole="header">
      {t("sessionComplete.workedOn")}
    </Text>
  );
}

function SaveStatusIndicator({ status }: { status: FocusSaveStatus }) {
  const { t } = useTranslation();
  const isVisible = status === "saving" || status === "saved";
  return (
    <View style={styles.focusStatus} accessibilityLiveRegion="polite">
      {isVisible ? (
        <Animated.View
          key={status}
          entering={FadeIn.duration(motion.quick)}
          exiting={FadeOut.duration(motion.quick)}
          style={styles.focusStatus}
        >
          {status === "saved" ? <Check size={14} color={colors.success} strokeWidth={3} /> : null}
          <Text style={[styles.focusStatusText, status === "saved" && styles.focusStatusSaved]}>
            {status === "saved"
              ? t("sessionComplete.focusSaved")
              : t("sessionComplete.focusSaving")}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function SaveErrorRow({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Animated.View
      entering={FadeIn.duration(motion.quick)}
      style={styles.focusErrorRow}
      accessibilityLiveRegion="assertive"
    >
      <Text style={styles.focusErrorText}>{t("sessionComplete.focusSaveFailed")}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.focusRetry, pressed && styles.focusRetryPressed]}
        testID="session-complete-focus-retry"
      >
        <Text style={styles.focusRetryText}>{t("sessionComplete.focusRetry")}</Text>
      </Pressable>
    </Animated.View>
  );
}
