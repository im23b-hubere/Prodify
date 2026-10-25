import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  BookOpen,
  Disc,
  Drum,
  Headphones,
  Layers,
  Mic,
  Mic2,
  Music2,
  PenLine,
  SlidersHorizontal,
  Waves,
  type LucideIcon,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, LinearTransition } from "react-native-reanimated";

import { SESSION_TYPE_IDS, SESSION_TYPES, type SessionType } from "../../constants/sessionTypes";
import { colors } from "../../constants/theme";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { SessionTypeMotif } from "./SessionTypeMotif";
import { sessionSetupStyles as styles } from "./sessionSetup.styles";

const ICON_BY_TYPE: Record<SessionType, LucideIcon> = {
  production: Headphones,
  beat_making: Drum,
  mixing: SlidersHorizontal,
  mastering: Disc,
  mix_and_master: Layers,
  sound_design: Waves,
  recording: Mic,
  songwriting: PenLine,
  arrangement: Music2,
  vocal_production: Mic2,
  learning: BookOpen,
};

function colorForType(type: SessionType): string {
  return SESSION_TYPES.find((s) => s.id === type)?.color ?? colors.primary;
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
  const Icon = ICON_BY_TYPE[type];
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
          // Dark card washed in the type's own colour, with its motif playing on the right.
          <LinearGradient
            colors={[`${accent}12`, `${accent}2e`]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.typeGradientActive}
          >
            <SessionTypeMotif type={type} accent={accent} />
            <View style={styles.typeRow}>
              <View
                style={[
                  styles.typeIconBadge,
                  { backgroundColor: `${accent}26`, borderColor: `${accent}73` },
                ]}
              >
                <Icon size={26} color={accent} strokeWidth={2.2} />
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

/** Cards ease aside for the focus panel: no spring, so nothing bounces. */
const CARD_SHIFT = LinearTransition.duration(240).easing(Easing.out(Easing.cubic));

export function SessionTypeSelector({
  selectedType,
  onSelect,
  belowSelected,
}: {
  selectedType: SessionType | null;
  onSelect: (type: SessionType) => void;
  /** Opens right under the selected card (the optional focus picker); the rest slide down. */
  belowSelected?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.typeColumn}>
      {SESSION_TYPE_IDS.map((type) => (
        <Animated.View key={type} layout={CARD_SHIFT}>
          <TypeCard
            type={type}
            label={sessionTypeLabel(type, t)}
            active={selectedType === type}
            onSelect={() => onSelect(type)}
          />
          {selectedType === type ? belowSelected : null}
        </Animated.View>
      ))}
    </View>
  );
}
