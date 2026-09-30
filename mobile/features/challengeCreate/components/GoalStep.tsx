import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { Minus, Plus } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { PressableScale } from "../../../components/ui/PressableScale";
import { colors } from "../../../constants/theme";
import { CHALLENGE_PRESETS, type ChallengePreset, type ChallengePresetId } from "../challengeDraft";
import { challengeCreateStyles as styles } from "../challengeCreate.styles";
import type { ChallengeDraftController } from "../hooks/useChallengeDraft";

type Props = {
  t: TFunction;
  controller: ChallengeDraftController;
};

export function GoalStep({ t, controller }: Props) {
  const { draft, dispatch, presetId, bounds, pace } = controller;
  return (
    <>
      <View accessibilityRole="radiogroup" style={styles.presetList}>
        {CHALLENGE_PRESETS.map((preset) => (
          <PresetCard
            key={preset.id}
            t={t}
            preset={preset}
            selected={preset.id === presetId}
            onChoose={(id) => dispatch({ type: "choosePreset", presetId: id })}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>{t("challengeCreate.fineTune")}</Text>
      <View style={styles.tuneCard}>
        <StepperRow
          label={t("challengeCreate.sessionsLabel")}
          value={draft.targetSessions}
          canDecrease={bounds.canDecreaseTarget}
          canIncrease={bounds.canIncreaseTarget}
          decreaseLabel={t("challengeCreate.fewerSessions")}
          increaseLabel={t("challengeCreate.moreSessions")}
          onStep={(delta) => dispatch({ type: "stepTarget", delta })}
        />
        <View style={styles.stepperDivider} />
        <StepperRow
          label={t("challengeCreate.daysLabel")}
          value={draft.durationDays}
          canDecrease={bounds.canDecreaseDuration}
          canIncrease={bounds.canIncreaseDuration}
          decreaseLabel={t("challengeCreate.fewerDays")}
          increaseLabel={t("challengeCreate.moreDays")}
          onStep={(delta) => dispatch({ type: "stepDuration", delta })}
        />
      </View>
      <Text style={styles.pace}>{t("challengeCreate.pace", { count: pace })}</Text>
    </>
  );
}

function PresetCard({
  t,
  preset,
  selected,
  onChoose,
}: {
  t: TFunction;
  preset: ChallengePreset;
  selected: boolean;
  onChoose: (id: ChallengePresetId) => void;
}) {
  const title = t(`challengeCreate.presets.${preset.id}.title`);
  const meta = t("challengeCreate.presetMeta", {
    sessions: preset.targetSessions,
    days: preset.durationDays,
  });
  return (
    <PressableScale
      style={[styles.presetCard, selected && styles.presetCardSelected]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}, ${meta}`}
      testID={`challenge-preset-${preset.id}`}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onChoose(preset.id);
      }}
    >
      <View style={styles.presetCopy}>
        <Text style={styles.presetTitle}>{title}</Text>
        <Text style={styles.presetMeta}>
          {meta} · {t(`challengeCreate.presets.${preset.id}.tagline`)}
        </Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </PressableScale>
  );
}

type StepperRowProps = {
  label: string;
  value: number;
  canDecrease: boolean;
  canIncrease: boolean;
  decreaseLabel: string;
  increaseLabel: string;
  onStep: (delta: 1 | -1) => void;
};

function StepperRow({
  label,
  value,
  canDecrease,
  canIncrease,
  decreaseLabel,
  increaseLabel,
  onStep,
}: StepperRowProps) {
  return (
    <View
      style={styles.stepperRow}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment" && canIncrease) onStep(1);
        if (event.nativeEvent.actionName === "decrement" && canDecrease) onStep(-1);
      }}
    >
      <Text style={styles.stepperLabel}>{label}</Text>
      <StepperButton label={decreaseLabel} enabled={canDecrease} onPress={() => onStep(-1)}>
        <Minus size={18} color={colors.textPrimary} />
      </StepperButton>
      <Text style={styles.stepperValue}>{value}</Text>
      <StepperButton label={increaseLabel} enabled={canIncrease} onPress={() => onStep(1)}>
        <Plus size={18} color={colors.textPrimary} />
      </StepperButton>
    </View>
  );
}

function StepperButton({
  label,
  enabled,
  onPress,
  children,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      hitSlop={6}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.stepperButton,
        !enabled && styles.stepperButtonDisabled,
        pressed && styles.stepperButtonPressed,
      ]}
    >
      {children}
    </Pressable>
  );
}
