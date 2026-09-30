import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors } from "../../constants/theme";

type Props = {
  name: string;
  photoUri: string | null;
  size: number;
  ring?: "accent" | "none";
};

/** Round profile photo with an initials fallback; `photoUri` must already be an absolute URL. */
export function Avatar({ name, photoUri, size, ring = "none" }: Props) {
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
    <View style={[shape, styles.fallback]}>
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>
        {name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: colors.textPrimary, fontFamily: fontFamily.heading },
});
