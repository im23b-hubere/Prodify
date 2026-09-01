import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { colors } from "../../../constants/theme";

const BAR_WIDTH = 96;

export function StatsScanLine() {
  const [width, setWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (width <= 0) return;
    translateX.setValue(-BAR_WIDTH);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: width,
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [translateX, width]);

  return (
    <View
      testID="stats-scan-line"
      style={styles.track}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.bar, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={["rgba(255,61,0,0)", "rgba(255,255,255,0.9)", colors.primary, "rgba(255,61,0,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 2,
    width: "100%",
    overflow: "hidden",
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 12,
  },
  bar: {
    width: BAR_WIDTH,
    height: 2,
  },
});
