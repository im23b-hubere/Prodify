import { Circle, HStack, Image, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityElement,
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  multilineTextAlignment,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

import type { SessionActivityProps } from "../lib/sessionLiveActivityProps";

const SessionActivity = (props: SessionActivityProps, environment: LiveActivityEnvironment) => {
  "widget";
  // The widget runtime receives only this function body: every constant must live in here.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const accent = environment.isLuminanceReduced
    ? "#FFFFFF"
    : props.isPaused
      ? "#FFB020"
      : "#FF3D00";
  const symbol = props.isPaused ? "pause.fill" : "waveform";

  const timer = (size: number) => (
    <Text
      timerInterval={{
        lower: new Date(props.timerStartMs),
        upper: new Date(props.timerStartMs + DAY_MS),
      }}
      countsDown={false}
      pauseTime={props.pausedAtMs != null ? new Date(props.pausedAtMs) : undefined}
      modifiers={[
        font({ size, weight: "bold", design: "rounded" }),
        monospacedDigit(),
        multilineTextAlignment("trailing"),
        foregroundStyle(props.isPaused ? "#888888" : "#FFFFFF"),
      ]}
    />
  );

  return {
    banner: (
      <HStack
        spacing={14}
        modifiers={[
          padding({ all: 16 }),
          activityBackgroundTint("#0A0A0A"),
          accessibilityElement("combine"),
        ]}
      >
        <ZStack>
          <Circle modifiers={[foregroundStyle(accent), frame({ width: 44, height: 44 })]} />
          <Image systemName={symbol} size={19} color="#0A0A0A" />
        </ZStack>
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(accent)]}>
            {props.statusLabel}
          </Text>
          <Text modifiers={[font({ size: 17, weight: "bold" }), foregroundStyle("#FFFFFF")]}>
            {props.title}
          </Text>
        </VStack>
        <Spacer />
        {timer(32)}
      </HStack>
    ),
    compactLeading: <Image systemName={symbol} color={accent} />,
    compactTrailing: (
      <HStack modifiers={[frame({ maxWidth: 64 })]}>{timer(15)}</HStack>
    ),
    minimal: <Image systemName={symbol} color={accent} />,
    expandedLeading: (
      <HStack spacing={8} modifiers={[padding({ leading: 4 })]}>
        <Image systemName={symbol} size={18} color={accent} />
        <Text modifiers={[font({ size: 15, weight: "semibold" }), foregroundStyle("#FFFFFF")]}>
          {props.title}
        </Text>
      </HStack>
    ),
    expandedTrailing: (
      <HStack modifiers={[padding({ trailing: 4 })]}>{timer(26)}</HStack>
    ),
    expandedBottom: (
      <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle(accent)]}>
        {props.statusLabel}
      </Text>
    ),
  };
};

export default createLiveActivity("SessionActivity", SessionActivity);
