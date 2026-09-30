import { Image } from "expo-image";
import { Text, View } from "react-native";

import { colors } from "../../../constants/theme";
import { challengeCreateStyles as styles } from "../challengeCreate.styles";

type Props = {
  name: string;
  photoUri: string | null;
  size: number;
  ring?: "accent" | "none";
};

export function ChallengeAvatar({ name, photoUri, size, ring = "none" }: Props) {
  const shape = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ring === "accent" ? 3 : 0,
    borderColor: colors.primary,
  };
  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={shape}
        contentFit="cover"
        transition={180}
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[shape, styles.avatarFallback]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.34 }]}>
        {name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}
