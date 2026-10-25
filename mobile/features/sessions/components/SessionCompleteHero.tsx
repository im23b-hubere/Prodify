import { ChevronRight, ReceiptText } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { StatTile } from "../../../components/ui/StatTile";
import { colors } from "../../../constants/theme";
import { progressionLevelName } from "../../../lib/progressionLevels";
import { sessionMoodLabel, sessionTypeLabel } from "../../../lib/sessionI18n";
import { formatDurationWords } from "../../../lib/sessionTime";
import type { SessionCompleteController } from "../hooks/useSessionCompleteController";
import { RECEIPT_TOOTH_DEPTH, styles } from "../sessionComplete.styles";
import {
  MINIMUM_COUNTED_SESSION_MINUTES,
  sessionHighlightKey,
  shortenSessionLabel,
} from "../sessionCompletePresentation";

export function SessionCompleteHero({ controller }: { controller: SessionCompleteController }) {
  const { t, session, progression, streak, xpGainEstimate } = controller;
  const moodLabel = session?.mood_level != null ? sessionMoodLabel(session.mood_level, t) : null;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tearY, setTearY] = useState(0);
  return (
    <View
      style={styles.heroCard}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height },
        );
      }}
    >
      {size.width > 0 && tearY > 0 ? (
        <ReceiptPaper width={size.width} height={size.height} tearY={tearY} />
      ) : null}
      <Text style={styles.heroEyebrow}>{t("sessionComplete.heroEyebrow")}</Text>
      <Text style={styles.bigDur}>{formatDurationWords(controller.durationSeconds, t)}</Text>
      <View style={styles.metaRow}>
        <View style={styles.typePill}>
          <Text style={styles.typePillText}>
            {sessionTypeLabel(session?.session_type ?? "beat_making", t)}
          </Text>
        </View>
        {moodLabel ? (
          <View style={styles.moodPill}>
            <Text style={styles.moodPillText}>{moodLabel}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.statGrid}>
        <StatTile
          label={t("sessionComplete.statXpLabel")}
          value={`+${xpGainEstimate}`}
          accent={xpGainEstimate > 0}
        />
        {streak !== null && streak > 0 ? (
          <StatTile
            label={t("sessionComplete.statStreakLabel")}
            value={`${streak}d`}
            icon="flame"
          />
        ) : null}
        {progression ? (
          <StatTile
            label={t("sessionComplete.statLevelLabel")}
            value={`${progression.current_level}`}
          />
        ) : null}
      </View>
      <ProgressHint controller={controller} />
      <Text style={styles.punchline}>{t(sessionHighlightKey(controller.feedback))}</Text>
      <DetailsStub
        label={t("sessionComplete.viewDetails")}
        onPress={controller.openDetails}
        onTearLine={setTearY}
      />
    </View>
  );
}

const CORNER = 24;
const NOTCH = 10;
const TOOTH_WIDTH = 12;

/**
 * Receipt outline: rounded top, a round notch bitten out of each side where the stub tears
 * off, and a torn zig-zag bottom edge.
 */
function receiptOutline(width: number, height: number, tearY: number): string {
  const depth = RECEIPT_TOOTH_DEPTH;
  const teeth = Math.max(1, Math.round(width / TOOTH_WIDTH));
  const step = width / teeth;
  let d = `M 0 ${CORNER} Q 0 0 ${CORNER} 0 L ${width - CORNER} 0 Q ${width} 0 ${width} ${CORNER}`;
  d += ` L ${width} ${tearY - NOTCH} A ${NOTCH} ${NOTCH} 0 0 0 ${width} ${tearY + NOTCH}`;
  d += ` L ${width} ${height - depth}`;
  for (let i = teeth; i > 0; i -= 1) {
    d += ` L ${i * step - step / 2} ${height} L ${(i - 1) * step} ${height - depth}`;
  }
  d += ` L 0 ${tearY + NOTCH} A ${NOTCH} ${NOTCH} 0 0 0 0 ${tearY - NOTCH}`;
  return `${d} Z`;
}

function ReceiptPaper({ width, height, tearY }: { width: number; height: number; tearY: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="receipt-paper" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3d1510" />
          <Stop offset="0.5" stopColor="#1a1010" />
          <Stop offset="1" stopColor="#120e0e" />
        </LinearGradient>
      </Defs>
      <Path
        d={receiptOutline(width, height, tearY)}
        fill="url(#receipt-paper)"
        stroke="rgba(255,61,0,0.22)"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * The hero reads as the session's receipt: a tear-off stub below its dashed line opens the
 * full details, so it never competes with the screen's one real button.
 */
function DetailsStub({
  label,
  onPress,
  onTearLine,
}: {
  label: string;
  onPress: () => void;
  /** Reports where the tear line sits in the card, so the paper can notch there. */
  onTearLine: (y: number) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID="session-complete-details"
      onLayout={(event) => onTearLine(Math.round(event.nativeEvent.layout.y))}
      style={({ pressed }) => [styles.stub, pressed && styles.stubPressed]}
    >
      <View style={styles.stubPerforation} />
      <View style={styles.stubRow}>
        <ReceiptText size={16} color={colors.textSecondary} strokeWidth={2.2} />
        <Text style={styles.stubText}>{label}</Text>
        <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

function ProgressHint({ controller }: { controller: SessionCompleteController }) {
  const { t, progression, xpGainEstimate } = controller;
  if (xpGainEstimate === 0)
    return (
      <Text style={styles.xpHintInline}>
        {t("sessionComplete.xpMinDurationHint", { min: MINIMUM_COUNTED_SESSION_MINUTES })}
      </Text>
    );
  if (!progression) return null;
  return (
    <Text style={styles.levelLine}>
      {t("sessionComplete.levelProgress", {
        name: shortenSessionLabel(progressionLevelName(t, progression.current_level)),
        toNext: progression.xp_to_next_level,
        nextName: shortenSessionLabel(progressionLevelName(t, progression.current_level + 1)),
      })}
    </Text>
  );
}
