import { useRouter } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import type { SessionType } from "../../../constants/sessionTypes";
import type { SkillBranch } from "../../../constants/skills";
import { colors, motion } from "../../../constants/theme";
import type { SessionDto } from "../../../types/session";
import {
  useSessionFocusReflection,
  type SessionFocusReflection,
} from "../hooks/useSessionFocusReflection";
import type { FocusSaveStatus } from "../hooks/useSkillFocusSync";
import { styles } from "../sessionComplete.styles";
import { SkillFocusReflectionPicker } from "./SkillFocusReflectionPicker";

type SessionCompleteFocusCardProps = { session: SessionDto; sessionType: SessionType };

export function SessionCompleteFocusCard({ session, sessionType }: SessionCompleteFocusCardProps) {
  const { t } = useTranslation();
  const reflection = useSessionFocusReflection(session, sessionType);
  const accent = sessionTypeAccent(sessionType);
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.standard).delay(motion.quick)}
      style={[styles.focusCard, { borderColor: `${accent}40` }]}
      testID="session-complete-focus"
    >
      <FocusCardHeader reflection={reflection} accent={accent} />
      <SkillFocusReflectionPicker
        selection={reflection.selection}
        progressBySkill={reflection.progressBySkill}
      />
      {reflection.saveStatus === "error" ? <SaveErrorRow onRetry={reflection.retrySave} /> : null}
      {reflection.progressLoadState === "error" ? (
        <Text style={styles.focusFootnote}>{t("sessionComplete.progressUnavailable")}</Text>
      ) : null}
      <SkillTreeLink branch={reflection.selection.visibleBranches[0]} />
    </Animated.View>
  );
}

function SkillTreeLink({ branch }: { branch: SkillBranch | undefined }) {
  const { t } = useTranslation();
  const { push } = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => push(branch ? `/skill-tree?branch=${branch}` : "/skill-tree")}
      style={({ pressed }) => [styles.skillTreeLink, pressed && styles.focusRetryPressed]}
      testID="session-complete-skill-tree"
    >
      <Text style={styles.skillTreeLinkText}>{t("sessionComplete.viewSkillTree")}</Text>
      <ChevronRight size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

function FocusCardHeader({
  reflection,
  accent,
}: {
  reflection: SessionFocusReflection;
  accent: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Text style={[styles.focusEyebrow, { color: accent }]}>
        {t("sessionComplete.focusEyebrow")}
      </Text>
      <View style={styles.focusCardHeader}>
        <Text style={styles.focusCardTitle} accessibilityRole="header">
          {reflection.hasPlannedFocus
            ? t("sessionComplete.focusTitlePlanned")
            : t("sessionComplete.focusTitle")}
        </Text>
        <SaveStatusIndicator status={reflection.saveStatus} />
      </View>
      <Text style={styles.focusCardHint}>
        {reflection.hasPlannedFocus
          ? t("sessionComplete.focusHintPlanned")
          : t("sessionComplete.focusHint")}
      </Text>
    </>
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
            {status === "saved" ? t("sessionComplete.focusSaved") : t("sessionComplete.focusSaving")}
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
