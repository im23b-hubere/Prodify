import type { TFunction } from "i18next";
import { AlertCircle } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { colors } from "../../../constants/theme";
import { friendsScreenStyles as styles } from "../styles/friendsScreen.styles";

type Props = {
  t: TFunction;
  message: string;
  onRetry: () => void;
};

/** A failed refresh while older data is still on screen: say so quietly, keep the content. */
export function FriendsRefreshErrorBanner({ t, message, onRetry }: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={styles.errorBanner}
      accessibilityRole="alert"
      testID="friends-refresh-error"
    >
      <AlertCircle size={18} color={colors.danger} />
      <View style={styles.errorBannerCopy}>
        <Text style={styles.errorBannerTitle}>{t("friendsOverview.refreshFailed")}</Text>
        <Text style={styles.errorBannerMessage} numberOfLines={2}>
          {message}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.errorBannerAction, pressed && styles.pressed]}
        onPress={onRetry}
      >
        <Text style={styles.errorBannerActionLabel}>{t("common.tryAgain")}</Text>
      </Pressable>
    </Animated.View>
  );
}
