import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors } from "../../constants/theme";
import { getLaunchPhase, setLaunchPhase, useLaunchPhase } from "../../lib/launch";
import { ProdifyWordmark } from "./ProdifyWordmark";

const DOT_COUNT = 3;
/** Matches `imageWidth` of the expo-splash-screen plugin in app.json. */
const LOGO_SIZE = 84;
/** If no screen asks for the reveal by then (an unexpected entry route), reveal anyway. */
const FALLBACK_REVEAL_MS = 5000;

// The zoom, in ms from the start of the reveal: the wordmark goes and the logo gathers
// itself, then it shoots up past the edges while the black falls away.
const GATHER_MS = 180;
const ZOOM_MS = 520;
const ZOOM_SCALE = 16;
const BACKDROP_FADE_AT = 300;
const BACKDROP_FADE_MS = 360;
const LOGO_FADE_AT = 420;
const LOGO_FADE_MS = 280;

function LoadingDot({ index }: { index: number }) {
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    opacity.set(
      withDelay(
        index * 180,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 350, easing: Easing.out(Easing.ease) }),
            withTiming(0.2, { duration: 350, easing: Easing.in(Easing.ease) }),
          ),
          -1,
          false,
        ),
      ),
    );
  }, [index, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * The launch layer: the same logo as the native splash, in the same place, with the
 * wordmark and loading dots fading in below. It sits above the app while the start route
 * decides where to go, then zooms away to reveal that screen.
 */
export function LaunchOverlay() {
  const phase = useLaunchPhase();
  const reduceMotion = useReducedMotion();

  const textOpacity = useSharedValue(0);
  const textShift = useSharedValue(8);
  const logoScale = useSharedValue(1);
  const logoOpacity = useSharedValue(1);
  const backdrop = useSharedValue(1);

  useEffect(() => {
    textOpacity.set(withTiming(1, { duration: 500 }));
    textShift.set(withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
    const fallback = setTimeout(() => {
      if (getLaunchPhase() === "splash") setLaunchPhase("revealing");
    }, FALLBACK_REVEAL_MS);
    return () => clearTimeout(fallback);
  }, [textOpacity, textShift]);

  useEffect(() => {
    if (phase !== "revealing") return;
    const finish = () => setLaunchPhase("done");

    textOpacity.set(withTiming(0, { duration: GATHER_MS }));
    textShift.set(withTiming(6, { duration: GATHER_MS }));

    if (reduceMotion) {
      // No zoom: one calm crossfade.
      logoOpacity.set(withTiming(0, { duration: 300 }));
      backdrop.set(
        withTiming(0, { duration: 320 }, (done) => {
          if (done) runOnJS(finish)();
        }),
      );
      return;
    }

    logoScale.set(
      withSequence(
        withTiming(0.86, { duration: GATHER_MS, easing: Easing.inOut(Easing.quad) }),
        withTiming(ZOOM_SCALE, { duration: ZOOM_MS, easing: Easing.in(Easing.exp) }),
      ),
    );
    logoOpacity.set(withDelay(LOGO_FADE_AT, withTiming(0, { duration: LOGO_FADE_MS })));
    backdrop.set(
      withDelay(
        BACKDROP_FADE_AT,
        withTiming(0, { duration: BACKDROP_FADE_MS, easing: Easing.out(Easing.quad) }, (done) => {
          if (done) runOnJS(finish)();
        }),
      ),
    );
  }, [phase, reduceMotion, textOpacity, textShift, logoScale, logoOpacity, backdrop]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.get(),
    transform: [{ scale: logoScale.get() }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.get(),
    transform: [{ translateY: textShift.get() }],
  }));

  if (phase === "done") return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      // Taps go to the app as soon as it starts showing.
      pointerEvents={phase === "splash" ? "auto" : "none"}
      accessibilityElementsHidden={phase !== "splash"}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <View style={styles.center} pointerEvents="none">
        <Animated.Image
          source={require("../../assets/branding/logo-startup.png")}
          style={[styles.logo, logoStyle]}
        />
        <Animated.View style={[styles.below, textStyle]}>
          <ProdifyWordmark style={styles.wordmark} />
          <View style={styles.dotsRow}>
            {Array.from({ length: DOT_COUNT }).map((_, i) => (
              <LoadingDot key={i} index={i} />
            ))}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: colors.background,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  // The app icon, at the size and corner radius of an icon tile.
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Wordmark and dots hang below the centred logo.
  below: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    marginTop: LOGO_SIZE / 2 + 12,
    alignItems: "center",
    gap: 12,
  },
  wordmark: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
  },
  dotsRow: {
    height: 18,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
});
