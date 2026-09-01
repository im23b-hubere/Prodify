import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { pressFeedbackStyle } from "../../../components/ui/pressFeedback";
import { paywallStyles as styles } from "../paywall.styles";

type Props = {
  period: string;
  price: string | null;
  badge?: string;
  selected: boolean;
  disabled: boolean;
  index: number;
  accessibilityLabel: string;
  onPress: () => void;
};

export function PaywallPlanOption({
  period,
  price,
  badge,
  selected,
  disabled,
  index,
  accessibilityLabel,
  onPress,
}: Props) {
  return (
    <Animated.View
      entering={FadeInUp.delay(index * 55)
        .duration(280)
        .springify()}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onPress();
        }}
        style={({ pressed }) => [
          styles.plan,
          selected && styles.planSelected,
          pressed && !disabled && styles.planPressed,
          pressFeedbackStyle(pressed, "default"),
          disabled && styles.planDisabled,
        ]}
      >
        <View style={styles.planCopy}>
          {badge ? (
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{badge}</Text>
            </View>
          ) : null}
          <Text style={styles.planPeriod}>{period}</Text>
        </View>
        {price ? (
          <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{price}</Text>
        ) : null}
        <View style={[styles.planRadio, selected && styles.planRadioOn]}>
          {selected ? <View style={styles.planRadioDot} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
