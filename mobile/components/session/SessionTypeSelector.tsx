import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  BookOpen,
  Disc,
  Drum,
  Layers,
  Mic,
  Mic2,
  Music2,
  PenLine,
  SlidersHorizontal,
  Waves,
  type LucideIcon,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { SESSION_TYPE_IDS, SESSION_TYPES, type SessionType } from "../../constants/sessionTypes";
import { colors } from "../../constants/theme";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { sessionSetupStyles as styles } from "./sessionSetup.styles";

type PatternKind = "beat" | "mix" | "sound";

const UI_BY_TYPE: Record<
  SessionType,
  { Icon: LucideIcon; gradient: readonly [string, string, string]; pattern: PatternKind }
> = {
  beat_making: { Icon: Drum, gradient: ["#c41e3a", "#ff6a3d", "#ff914d"], pattern: "beat" },
  mixing: { Icon: SlidersHorizontal, gradient: ["#3d2a6b", "#6b4dc4", "#a259ff"], pattern: "mix" },
  mastering: { Icon: Disc, gradient: ["#003d26", "#00aa6c", "#00ff88"], pattern: "mix" },
  mix_and_master: { Icon: Layers, gradient: ["#553300", "#cc7700", "#ffaa00"], pattern: "mix" },
  sound_design: { Icon: Waves, gradient: ["#0d4f4a", "#1a8a7e", "#00c9b7"], pattern: "sound" },
  recording: { Icon: Mic, gradient: ["#1a3a66", "#2a60cc", "#4488ff"], pattern: "mix" },
  songwriting: { Icon: PenLine, gradient: ["#662244", "#cc5599", "#ff88dd"], pattern: "beat" },
  arrangement: { Icon: Music2, gradient: ["#226655", "#55ccaa", "#88ffcc"], pattern: "beat" },
  vocal_production: { Icon: Mic2, gradient: ["#665522", "#cc9933", "#ffcc44"], pattern: "mix" },
  learning: { Icon: BookOpen, gradient: ["#442266", "#9966dd", "#cc88ff"], pattern: "beat" },
};

function colorForType(type: SessionType): string {
  return SESSION_TYPES.find((s) => s.id === type)?.color ?? colors.primary;
}

function PatternBeatMaking() {
  const heights = [12, 22, 16, 28, 14, 24, 18, 26, 15, 20];
  return (
    <View style={styles.patternRoot} pointerEvents="none">
      <View style={styles.patternBeatRow}>
        {heights.map((h, i) => (
          <View key={i} style={[styles.patternBeatBar, { height: h }]} />
        ))}
      </View>
    </View>
  );
}

function PatternMixing() {
  const heights = [18, 28, 22, 34, 16, 30, 24, 26];
  return (
    <View style={styles.patternRoot} pointerEvents="none">
      <View style={styles.patternMixRow}>
        {heights.map((h, i) => (
          <View key={i} style={styles.patternMixTrack}>
            <View style={[styles.patternMixCap, { height: h }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

function PatternSoundDesign() {
  const rows = 4;
  const cols = 8;
  return (
    <View style={styles.patternRoot} pointerEvents="none">
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={[styles.patternSoundRow, r % 2 === 1 && styles.patternSoundRowOffset]}>
          {Array.from({ length: cols }).map((__, c) => (
            <View key={`${r}-${c}`} style={styles.patternSoundDot} />
          ))}
        </View>
      ))}
    </View>
  );
}

function TypePattern({ kind }: { kind: PatternKind }) {
  switch (kind) {
    case "beat":
      return <PatternBeatMaking />;
    case "mix":
      return <PatternMixing />;
    case "sound":
      return <PatternSoundDesign />;
    default:
      return null;
  }
}

function TypeCard({
  type,
  label,
  active,
  onSelect,
}: {
  type: SessionType;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const visual = UI_BY_TYPE[type];
  const Icon = visual.Icon;
  const accent = colorForType(type);
  const inactiveIcon = `${accent}8c`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      testID={`session-type-${type}`}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        onSelect();
      }}
      style={({ pressed }) => [styles.typeCardPressable, pressed && styles.typeCardPressed]}
    >
      <View style={[styles.typeCardOuter, active && { borderColor: accent }]}>
        {active ? (
          <LinearGradient colors={[...visual.gradient]} style={styles.typeGradientActive}>
            <View style={styles.typePatternLayer} pointerEvents="none">
              <TypePattern kind={visual.pattern} />
            </View>
            <View style={styles.typeRow}>
              <View style={styles.typeIconBadge}>
                <Icon size={26} color="#ffffff" strokeWidth={2.2} />
              </View>
              <Text style={styles.typeLabel}>{label}</Text>
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.typeInner}>
            <View style={[styles.typeIconBadgeMuted, { borderColor: `${accent}40` }]}>
              <Icon size={26} color={inactiveIcon} strokeWidth={2.2} />
            </View>
            <Text style={styles.typeLabelMuted}>{label}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function SessionTypeSelector({
  selectedType,
  onSelect,
}: {
  selectedType: SessionType | null;
  onSelect: (type: SessionType) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.typeColumn}>
      {SESSION_TYPE_IDS.map((type) => (
        <TypeCard
          key={type}
          type={type}
          label={sessionTypeLabel(type, t)}
          active={selectedType === type}
          onSelect={() => onSelect(type)}
        />
      ))}
    </View>
  );
}
