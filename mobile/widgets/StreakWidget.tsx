import {
  AccessoryWidgetBackground,
  Circle,
  HStack,
  Image,
  Label,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityElement,
  accessibilityLabel,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  kerning,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  widgetAccentedRenderingMode,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

import type { StreakWidgetProps } from "../lib/streakWidgetTimeline";

const StreakWidget = (props: StreakWidgetProps, environment: WidgetEnvironment) => {
  "widget";
  // The widget runtime receives only this function body: every constant must live in here.
  const flameColorByMood = {
    start: "#888888",
    secured: "#FF3D00",
    pending: "#FF7A3D",
    atRisk: "#FFB020",
    lastChance: "#FF4444",
    broken: "#666666",
  };
  const glowColorByMood = {
    start: "#161616",
    secured: "#2E1006",
    pending: "#221409",
    atRisk: "#2B1F05",
    lastChance: "#330B0B",
    broken: "#141414",
  };
  // Tinted (iOS 18) and Lock Screen rendering drop custom colors, so shapes must carry meaning.
  const isFullColor =
    environment.widgetRenderingMode == null || environment.widgetRenderingMode === "fullColor";
  const accent = isFullColor ? flameColorByMood[props.mood] : "#FFFFFF";
  const flameSymbol = props.mood === "broken" || props.mood === "start" ? "flame" : "flame.fill";
  const openStreakHistory = widgetURL("prodify://streak/history");
  const voiceOver = [accessibilityElement("ignore"), accessibilityLabel(props.accessibilityLabel)];
  const transparentBackground = containerBackground("clear", "widget");
  const glowBackground = containerBackground(
    {
      type: "linearGradient",
      colors: [glowColorByMood[props.mood], "#0A0A0A"],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    "widget",
  );

  if (environment.widgetFamily === "accessoryInline") {
    return (
      <Label
        title={`${props.streak} · ${props.headline}`}
        systemImage={flameSymbol}
        modifiers={[openStreakHistory, transparentBackground, ...voiceOver]}
      />
    );
  }

  if (environment.widgetFamily === "accessoryCircular") {
    return (
      <ZStack modifiers={[openStreakHistory, transparentBackground, ...voiceOver]}>
        <AccessoryWidgetBackground />
        <VStack spacing={0}>
          <Image systemName={flameSymbol} size={13} />
          <Text
            modifiers={[
              font({ size: 20, weight: "heavy", design: "rounded" }),
              monospacedDigit(),
              minimumScaleFactor(0.5),
            ]}
          >
            {props.streak}
          </Text>
        </VStack>
      </ZStack>
    );
  }

  if (environment.widgetFamily === "accessoryRectangular") {
    return (
      <HStack modifiers={[openStreakHistory, transparentBackground, ...voiceOver]}>
        <VStack alignment="leading" spacing={1}>
          <HStack spacing={4}>
            <Image systemName={flameSymbol} size={15} />
            <Text
              modifiers={[
                font({ size: 20, weight: "heavy", design: "rounded" }),
                monospacedDigit(),
              ]}
            >
              {props.streak}
            </Text>
          </HStack>
          <Text modifiers={[font({ size: 13, weight: "semibold" }), minimumScaleFactor(0.8)]}>
            {props.headline}
          </Text>
        </VStack>
        <Spacer />
      </HStack>
    );
  }

  const flame = (
    <Image
      systemName={flameSymbol}
      size={26}
      color={accent}
      modifiers={[widgetAccentedRenderingMode("accented")]}
    />
  );
  const streakNumber = (
    <Text
      modifiers={[
        font({ size: 46, weight: "heavy", design: "rounded" }),
        monospacedDigit(),
        lineLimit(1),
        minimumScaleFactor(0.5),
        foregroundStyle("#FFFFFF"),
      ]}
    >
      {props.streak}
    </Text>
  );
  const streakLabel = (
    <Text
      modifiers={[
        font({ size: 11, weight: "bold" }),
        kerning(0.8),
        lineLimit(1),
        minimumScaleFactor(0.7),
        foregroundStyle("#888888"),
      ]}
    >
      {props.streakLabel}
    </Text>
  );
  const headline = (
    <Text
      modifiers={[
        font({ size: 13, weight: "semibold" }),
        lineLimit(2),
        minimumScaleFactor(0.8),
        foregroundStyle(accent),
      ]}
    >
      {props.headline}
    </Text>
  );

  if (environment.widgetFamily !== "systemMedium") {
    return (
      <HStack modifiers={[openStreakHistory, glowBackground, ...voiceOver]}>
        <VStack alignment="leading" spacing={2}>
          {flame}
          <Spacer />
          {streakNumber}
          {streakLabel}
          {headline}
        </VStack>
        <Spacer />
      </HStack>
    );
  }

  const todayIndex = props.week.findIndex((day) => day.isToday);
  const dotColor = (state: string, index: number) => {
    if (state === "session") return isFullColor ? "#FF3D00" : "#FFFFFF";
    if (state === "freeze") return isFullColor ? "#4FC3F7" : "#FFFFFFB3";
    if (index === todayIndex) return isFullColor ? "#3A3A3A" : "#FFFFFF59";
    if (index < todayIndex) return isFullColor ? "#242424" : "#FFFFFF33";
    return isFullColor ? "#161616" : "#FFFFFF1A";
  };

  // Fixed columns keep every weekday on one line and every dot on one row, whatever the locale.
  const weekStrip = (
    <HStack spacing={4}>
      {props.week.map((day, index) => (
        <VStack key={index} spacing={6} modifiers={[frame({ width: 22 })]}>
          <Text
            modifiers={[
              font({ size: 10, weight: day.isToday ? "heavy" : "semibold" }),
              lineLimit(1),
              minimumScaleFactor(0.7),
              foregroundStyle(day.isToday ? "#FFFFFF" : "#666666"),
            ]}
          >
            {day.label}
          </Text>
          <ZStack>
            <Circle
              modifiers={[
                foregroundStyle(dotColor(day.state, index)),
                frame({ width: 20, height: 20 }),
              ]}
            />
            {day.state === "session" ? (
              <Image systemName="flame.fill" size={10} color="#0A0A0A" />
            ) : null}
            {day.state === "freeze" ? (
              <Image systemName="snowflake" size={10} color="#0A0A0A" />
            ) : null}
          </ZStack>
        </VStack>
      ))}
    </HStack>
  );

  return (
    <HStack spacing={0} modifiers={[openStreakHistory, glowBackground, ...voiceOver]}>
      <VStack alignment="leading" spacing={2}>
        {flame}
        <Spacer />
        {streakNumber}
        {streakLabel}
      </VStack>
      <Spacer minLength={12} />
      <VStack alignment="leading" spacing={0}>
        {headline}
        <Spacer />
        {weekStrip}
      </VStack>
    </HStack>
  );
};

export default createWidget("StreakWidget", StreakWidget);
