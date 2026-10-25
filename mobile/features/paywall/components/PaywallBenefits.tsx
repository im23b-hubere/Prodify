import {
  ChartColumn,
  Flame,
  Network,
  Swords,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";

import { colors } from "../../../constants/theme";
import { paywallStyles as styles } from "../paywall.styles";

/** What Premium unlocks, each with the icon of the feature it stands for. */
const BENEFITS: readonly { key: string; Icon: LucideIcon }[] = [
  { key: "paywall.features.sessions", Icon: Timer },
  { key: "paywall.features.stats", Icon: ChartColumn },
  { key: "paywall.features.skills", Icon: Network },
  { key: "paywall.features.ranks", Icon: Trophy },
  { key: "paywall.features.friends", Icon: Swords },
  { key: "paywall.features.streaks", Icon: Flame },
];

export function PaywallBenefits() {
  const { t } = useTranslation();
  return (
    <View style={styles.benefits}>
      {BENEFITS.map(({ key, Icon }, index) => (
        <Animated.View
          key={key}
          entering={FadeInRight.duration(320).delay(180 + index * 60)}
          style={styles.benefitRow}
        >
          <View style={styles.benefitIcon}>
            <Icon size={22} color={colors.primary} strokeWidth={2} />
          </View>
          {/* Always one line: a longer translation shrinks a touch instead of wrapping. */}
          <Text
            style={styles.benefitText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {t(key)}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}
