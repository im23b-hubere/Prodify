import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { memo } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { Avatar } from "../../../../components/ui/Avatar";
import { ListSection } from "../../../../components/ui/list/ListSection";
import { PressableScale } from "../../../../components/ui/PressableScale";
import type { FriendActivityDto } from "../../../../types/friends";
import { profilePictureUrl } from "../../../profile/friendProfilePresentation";
import {
  friendsActivityStyles as styles,
  LIVE_AVATAR_SIZE,
  LIVE_PULSE_ANIMATION,
} from "../../styles/friendsActivity.styles";
import { formatSessionTypeLabel } from "../../utils/friendsScreenFormat";

type Props = {
  t: TFunction;
  live: FriendActivityDto[];
  /** A running session is private until it ends, so the strip leads to the profile. */
  onOpenProfile: (userId: number) => void;
};

/** Friends producing right now; hidden entirely when nobody is live. */
export const LiveNowStrip = memo(function LiveNowStrip({ t, live, onOpenProfile }: Props) {
  const reducedMotion = useReducedMotion();
  if (live.length === 0) return null;
  return (
    <ListSection
      title={t("friendsOverview.liveTitle")}
      count={live.length}
      carded={false}
      testID="friends-live"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.liveStrip}
        contentContainerStyle={styles.liveContent}
      >
        {live.map((item) => {
          const type = formatSessionTypeLabel(item.session_type, t);
          return (
            <PressableScale
              key={item.user_id}
              style={styles.liveFriend}
              accessibilityRole="button"
              accessibilityLabel={t("friendsOverview.liveA11y", { name: item.username, type })}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                onOpenProfile(item.user_id);
              }}
              testID={`friends-live-${item.user_id}`}
            >
              <View style={styles.liveAvatar}>
                <Animated.View
                  style={[styles.livePulse, reducedMotion ? null : LIVE_PULSE_ANIMATION]}
                />
                <Avatar
                  name={item.username}
                  photoUri={profilePictureUrl(item.profile_picture_url)}
                  size={LIVE_AVATAR_SIZE}
                  ring="accent"
                />
              </View>
              <Text style={styles.liveName} numberOfLines={1}>
                {item.username}
              </Text>
              <Text style={styles.liveType} numberOfLines={1}>
                {type}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </ListSection>
  );
});
