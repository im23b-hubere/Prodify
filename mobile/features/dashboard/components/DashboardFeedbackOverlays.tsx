import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Trophy } from "lucide-react-native";
import { Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { glyphRowStyle } from "../../../components/icons/ProdifyGlyphs";
import { StreakBreakModal } from "../../../components/streak/StreakBreakModal";
import { styles } from "../dashboardScreen.styles";

type Props = {
  milestoneToast: string | null;
  socialToast: string | null;
  breakModalOpen: boolean;
  breakModalStreak: number;
  dismissBreakModal: () => void;
  openSessionSetup: () => void;
};

export function DashboardFeedbackOverlays({
  milestoneToast,
  socialToast,
  breakModalOpen,
  breakModalStreak,
  dismissBreakModal,
  openSessionSetup,
}: Props) {
  const insets = useSafeAreaInsets();
  const startFresh = () => {
    dismissBreakModal();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    openSessionSetup();
  };

  return (
    <>
      {milestoneToast ? (
        <Animated.View
          entering={FadeInUp.duration(320)}
          style={[styles.milestoneToast, { top: insets.top + 8 }]}
        >
          <LinearGradient
            colors={["#ff6a3d", "#a259ff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.milestoneToastInner}
          >
            <View style={[glyphRowStyle, styles.milestoneToastRow]}>
              <Trophy size={18} color="#fff" strokeWidth={2.2} fill="#fff" />
              <Text style={styles.milestoneToastText}>{milestoneToast}</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      ) : null}
      {socialToast ? (
        <Animated.View
          entering={FadeInUp.duration(220)}
          style={[styles.socialToast, { top: insets.top + 62 }]}
        >
          <Text style={styles.socialToastText}>{socialToast}</Text>
        </Animated.View>
      ) : null}
      <StreakBreakModal
        visible={breakModalOpen}
        brokenStreak={breakModalStreak}
        onStartFresh={startFresh}
      />
    </>
  );
}
