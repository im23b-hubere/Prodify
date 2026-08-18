import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { TextButton } from "../../components/ui/TextButton";
import { colors, spacing } from "../../constants/theme";
import type { WeeklyWrappedViewerProps } from "./WeeklyWrappedViewer";
import { styles } from "./WeeklyWrappedViewer.styles";

type ControlProps = WeeklyWrappedViewerProps & {
  activeIndex: number;
  topInset: number;
  bottomInset: number;
};

export function WrappedTopBar({ slides, activeIndex, topInset, t, onClose }: ControlProps) {
  return (
    <View style={[styles.topBar, { paddingTop: topInset + spacing.sm }]}>
      <View style={styles.topRow}>
        <View style={styles.progressRow}>
          {slides.map((slide, index) => (
            <View
              key={slide.id}
              style={[styles.progressSegment, index <= activeIndex && styles.progressSegmentActive]}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("weeklyRecap.close")}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            onClose();
          }}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
        >
          <X color={colors.textPrimary} size={20} />
        </Pressable>
      </View>
    </View>
  );
}

export function WrappedBottomBar(props: ControlProps) {
  const { t, activeIndex, slides } = props;
  const kind = slides[activeIndex]?.kind;
  return (
    <View style={[styles.bottomBar, { paddingBottom: props.bottomInset + spacing.md }]}>
      {kind !== "outro" && kind !== "empty" ? (
        <Text style={styles.swipeHint}>{t("weeklyRecap.wrappedSwipeHint")}</Text>
      ) : null}
      {kind === "empty" && props.onStartSession ? (
        <PrimaryButton label={t("weeklyRecap.emptyCta")} onPress={props.onStartSession} />
      ) : null}
      {props.statsWarning && activeIndex === 0 ? (
        <Text style={styles.warningText}>{props.statsWarning}</Text>
      ) : null}
      {props.showGenerate && props.onGenerate && activeIndex === 0 ? (
        <GenerateActions {...props} />
      ) : null}
      {kind === "outro" && props.showShare ? <ShareActions {...props} /> : null}
    </View>
  );
}

function GenerateActions(props: ControlProps) {
  return (
    <View style={styles.actionBlock}>
      <PrimaryButton
        label={
          props.generateBusy
            ? props.t("weeklyRecap.generating")
            : props.t("weeklyRecap.generateCta")
        }
        loading={props.generateBusy}
        onPress={props.onGenerate!}
      />
      {props.generateError ? <Text style={styles.errorText}>{props.generateError}</Text> : null}
    </View>
  );
}

function ShareActions(props: ControlProps) {
  const templates = [
    ["minimal", props.t("weeklyRecap.templateMinimal")],
    ["gradient", props.t("weeklyRecap.templateGradient")],
    ["bold", props.t("weeklyRecap.templateBold")],
  ] as const;
  return (
    <View style={styles.actionBlock}>
      <View style={styles.templateRow}>
        {templates.map(([id, label]) => (
          <Pressable
            key={id}
            style={[styles.templateChip, props.shareTemplate === id && styles.templateChipActive]}
            onPress={() => props.onShareTemplateChange(id)}
          >
            <Text
              style={[
                styles.templateChipText,
                props.shareTemplate === id && styles.templateChipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {props.onShareCard ? (
        <PrimaryButton
          label={
            props.shareBusy
              ? props.t("weeklyRecap.shareBusy")
              : props.t("weeklyRecap.shareWeekCardCta")
          }
          disabled={props.shareBusy}
          onPress={props.onShareCard}
        />
      ) : null}
      {props.onShareText ? (
        <SecondaryButton label={props.t("weeklyRecap.shareCta")} onPress={props.onShareText} />
      ) : null}
      {props.onSetGoals ? (
        <TextButton label={props.t("weeklyRecap.setGoals")} onPress={props.onSetGoals} />
      ) : null}
    </View>
  );
}
