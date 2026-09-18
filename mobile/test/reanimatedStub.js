const { Image, Text, View } = require("react-native");

const identity = (value) => value;
const enter = {
  duration: () => enter,
  delay: () => enter,
  springify: () => enter,
  damping: () => enter,
};

module.exports = {
  __esModule: true,
  default: { View, Image, Text, createAnimatedComponent: identity },
  View,
  Image,
  Text,
  FadeIn: enter,
  FadeOut: enter,
  FadeInUp: enter,
  FadeInDown: enter,
  SlideInDown: enter,
  SlideOutDown: enter,
  useSharedValue: (value) => ({ value }),
  useAnimatedStyle: (fn) => fn(),
  useAnimatedProps: (fn) => fn(),
  withRepeat: identity,
  withTiming: identity,
  withSpring: identity,
  withSequence: identity,
  withDelay: (_delay, value) => value,
  runOnJS: identity,
  runOnUI: identity,
  createAnimatedComponent: identity,
  Easing: {
    inOut: identity,
    in: identity,
    out: identity,
    ease: identity,
    linear: identity,
    cubic: identity,
    quad: identity,
    bezier: () => identity,
  },
  interpolate: () => 0,
  interpolateColor: (_value, _input, output) => output[0],
  Extrapolation: { CLAMP: "clamp" },
};
